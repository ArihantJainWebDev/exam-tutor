import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState, updateMastery, pCorrect, type State } from '../src/lib/mastery';
import { nextQuestion, selectPractice } from '../src/lib/selection';
import { diagnosticItems } from '../src/lib/diagnostic';
import { loadPhysicsContent } from '../src/lib/content.server';
import { createMemoryStore } from '../src/platform/store/memory';
import { createSessionService } from '../src/app/tutor/session-service';
import { createFileStore } from '../src/platform/store/file';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const evidence = (correct: boolean, difficulty: 1 | 2 | 3) => ({ correct, difficulty, at: '2026-10-31T12:00:00Z' });
test('Rasch update respects difficulty, direction and probability ordering', () => {
  const s = initialState();
  assert.ok(updateMastery(s, evidence(true, 3)).mastery > updateMastery(s, evidence(true, 1)).mastery);
  assert.ok(updateMastery(s, evidence(false, 1)).mastery < updateMastery(s, evidence(false, 3)).mastery);
  assert.ok(updateMastery(s, evidence(true, 2)).mastery > s.mastery);
  assert.ok(updateMastery(s, evidence(false, 2)).mastery < s.mastery);
  assert.ok(pCorrect(1, 2) > pCorrect(0, 2));
});
test('repeated evidence converges within bounds; confidence and streak are evidence-based', () => {
  let s = initialState(); const trajectory: number[] = [];
  for (let i = 0; i < 1000; i++) { s = updateMastery(s, evidence(true, 2)); if (i < 10) trajectory.push(s.mastery); }
  assert.ok(trajectory.every((v, i) => i === 0 || v > trajectory[i - 1]));
  assert.ok(s.logit <= 3 && s.mastery > 0.9); assert.equal(s.confidence, 1);
  s = updateMastery(s, evidence(false, 2)); assert.equal(s.correctStreak, 0);
  for (let i = 0; i < 1000; i++) s = updateMastery(s, evidence(false, 2));
  assert.ok(s.logit >= -3 && s.mastery < 0.1);
});
test('multi-concept evidence splits learning rate and diagnostic increases it', () => {
  const s = initialState(); const ev = evidence(true, 2);
  assert.equal(updateMastery(s, { ...ev, conceptCount: 2 }).logit, updateMastery(s, ev).logit / 2);
  assert.equal(updateMastery(s, { ...ev, diagnostic: true }).logit, updateMastery(s, ev).logit * 1.4);
  assert.equal(updateMastery(s, ev).attempts, 1);
});
test('weak series concept outranks strong concepts and difficulty calibrates to mastery', async () => {
  const c = await loadPhysicsContent();
  const state: Record<string, State> = Object.fromEntries(c.graph.map(n => [n.id, { ...initialState(), mastery: 0.8, logit: Math.log(4), attempts: 5 }]));
  state['elec:series-circuits'] = { ...initialState(), mastery: 0.3, logit: Math.log(0.3 / 0.7), attempts: 5 };
  const opts = { now: '2026-10-31', recentIds: [] };
  assert.ok(nextQuestion(state, c.bank, c.graph, opts)?.item.conceptIds.includes('elec:series-circuits'));
  const bank = c.bank.filter(i => i.conceptIds.length === 1 && i.conceptIds[0] === 'elec:series-circuits');
  state['elec:series-circuits'].mastery = 0.8;
  assert.equal(nextQuestion(state, bank, c.graph, opts)?.item.difficulty, 3);
  state['elec:series-circuits'].mastery = 0.3;
  assert.equal(nextQuestion(state, bank, c.graph, opts)?.item.difficulty, 1);
});
test('finite-bank fallback excludes immediate repeat and empty bank returns no selection', async () => {
  const c = await loadPhysicsContent(); const bank = c.bank.slice(0, 2);
  const opts = { now: '2026-10-31', recentIds: bank.map(i => i.id) };
  assert.equal(selectPractice({}, bank, c.graph, opts)?.item.id, bank[0].id);
  assert.equal(selectPractice({}, [], c.graph, opts), undefined);
});
test('diagnostic spans five chapters with eight unique items', async () => {
  const c = await loadPhysicsContent(); const items = diagnosticItems(c.bank);
  assert.equal(items.length, 8); assert.equal(new Set(items.map(i => i.id)).size, 8);
  assert.equal(new Set(items.flatMap(i => i.conceptIds.map(id => c.graph.find(n => n.id === id)!.chapter))).size, 5);
});
test('answer persists evidence, grades on server, resumes feedback and deduplicates retries', async () => {
  const c = await loadPhysicsContent(); const store = createMemoryStore(); const svc = createSessionService(store, c);
  let view = await svc.start('diagnostic');
  assert.equal('answer' in view.question!, false);
  const token = view.token!; const question = c.bank.find(i => i.id === view.question!.id)!;
  const wrong = question.options!.find(o => o !== question.answer)!;
  view = await svc.answer({ token, answer: wrong, reasoning: 'I divided in the wrong order.' });
  assert.equal(view.feedback?.correct, false); assert.ok(view.feedback!.changes[0].after < 0.5);
  await svc.answer({ token, answer: String(question.answer), reasoning: 'Retry.' });
  assert.equal((await store.all('tutor.attempt')).length, 1);
  assert.equal((await store.latest('tutor.mastery', question.conceptIds[0]))?.version, 1);
  const restored = createSessionService(createMemoryStore(store.dump()), c);
  assert.equal((await restored.view()).feedback?.token, token);
  view = await svc.advance(token); assert.equal(view.diagnosticIndex, 1);
  await assert.rejects(svc.answer({ token, answer: wrong, reasoning: 'Stale tab.' }), /changed/);
});
test('malformed and premature submissions do not write learner evidence', async () => {
  const c = await loadPhysicsContent(); const store = createMemoryStore(); const svc = createSessionService(store, c);
  const view = await svc.start('practice');
  await assert.rejects(svc.advance(view.token), /Submit/);
  await assert.rejects(svc.answer({ token: view.token, answer: 'fake option', reasoning: 'test' }), /listed/);
  await assert.rejects(svc.answer({ token: view.token, answer: view.question!.options[0], reasoning: '' }), /reasoning/);
  assert.equal((await store.all('tutor.mastery')).length, 0);
  assert.equal((await store.all('tutor.attempt')).length, 0);
});
test('eight diagnostic submissions transition to adaptive practice with retained mastery', async () => {
  const c = await loadPhysicsContent(); const store = createMemoryStore(); const svc = createSessionService(store, c);
  let view = await svc.start('diagnostic');
  for (let i = 0; i < 8; i++) {
    const item = c.bank.find(q => q.id === view.question!.id)!;
    view = await svc.answer({ token: view.token, answer: String(item.answer), reasoning: item.explanation });
    view = await svc.advance(view.token);
  }
  assert.equal(view.mode, 'practice'); assert.equal(view.answered, 8);
  assert.ok(view.mastery.some(c => c.attempts > 0)); assert.ok(view.selection?.conceptId);
  assert.equal((await store.all('tutor.attempt')).length, 8);
});
test('wrong answer on a weak concept leads to a different question targeting that concept', async () => {
  const c = await loadPhysicsContent(); const store = createMemoryStore();
  for (const concept of c.graph) {
    const mastery = concept.id === 'elec:series-circuits' ? 0.3 : 0.8;
    await store.put({ namespace: 'tutor.mastery', key: concept.id, at: '2026-10-31T10:00:00Z', sourceId: 'test-prior',
      value: { ...initialState(), mastery, logit: Math.log(mastery / (1 - mastery)), attempts: 5, confidence: 1 } });
  }
  const svc = createSessionService(store, c); let v = await svc.start('practice');
  assert.ok(v.question!.conceptIds.includes('elec:series-circuits'));
  const firstId = v.question!.id; const item = c.bank.find(i => i.id === firstId)!;
  v = await svc.answer({ token: v.token, answer: item.options!.find(o => o !== item.answer), reasoning: 'The first bulb uses the current.' });
  assert.ok(v.feedback!.changes[0].after < 0.3);
  v = await svc.advance(v.token);
  assert.notEqual(v.question!.id, firstId); assert.equal(v.selection?.conceptId, 'elec:series-circuits');
});
test('file-backed session and mastery survive a fresh service/store instance', async () => {
  const parent = path.resolve('data');
  await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(path.join(parent, 'test-session-'));
  const file = path.join(dir, 'store.json');
  try {
    const c = await loadPhysicsContent(); const svc = createSessionService(createFileStore(file), c);
    let v = await svc.start('practice');
    const item = c.bank.find(i => i.id === v.question!.id)!;
    v = await svc.answer({ token: v.token, answer: String(item.answer), reasoning: item.explanation });
    // FileStore intentionally persists asynchronously. Wait for its final session snapshot.
    let persisted = false;
    for (let i = 0; i < 100; i++) {
      try { const json = JSON.parse(await readFile(file, 'utf8')); persisted = json.facts.some((f: { namespace: string; value: { feedback?: unknown } }) => f.namespace === 'tutor.session' && f.value.feedback); } catch { /* initial file not yet written */ }
      if (persisted) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(persisted, 'final session snapshot must reach disk');
    const restored = await createSessionService(createFileStore(file), c).view();
    assert.equal(restored.answered, 1); assert.equal(restored.feedback?.selectedAnswer, item.answer);
    assert.ok(restored.mastery.some(n => n.attempts === 1));
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), parent, 'cleanup stays inside the app data directory');
    await rm(dir, { recursive: true, force: true });
  }
});
