import assert from 'node:assert/strict';
import { test } from 'node:test';
import cases from '../mocks/tutor.classify.cases.json';
import { loadPhysicsContent } from '../src/lib/content.server';
import { candidateMisconceptions, detectedMisconception, noMisconception, validateClassification, type ReasoningAnalysis } from '../src/lib/misconception';
import { scheduleReview, dueReviews, type ReviewState } from '../src/lib/srs';
import { initialState, updateMastery } from '../src/lib/mastery';
import { rankQuestions } from '../src/lib/selection';
import { createReasoningClassifier as makeClassifier } from '../src/app/tutor/classifier';
import type { LlmRequest } from '../src/platform/llm';
const createReasoningClassifier = (hooks: Pick<LlmRequest, 'cwd' | 'fetchImpl' | 'fixtureMode'> = {}): ReturnType<typeof makeClassifier> => async (input, taxonomy) => {
  const variant = hooks.fixtureMode ? cases.find(c => c.itemId === input.item.id && c.reasoning === input.reasoning.trim())?.variant : undefined;
  return makeClassifier({ ...hooks, mockVariant: variant })(input, taxonomy);
};
import { createSessionService } from '../src/app/tutor/session-service';
import { createMemoryStore } from '../src/platform/store/memory';

const at = '2026-10-31T10:00:00.000Z';
function env(mock = '1') {
  const keys = ['MOCK_LLM', 'LLM_API_KEY', 'CACHE_LLM'] as const;
  const values = keys.map(k => process.env[k]);
  process.env.MOCK_LLM = mock; process.env.LLM_API_KEY = 'test-only'; process.env.CACHE_LLM = '0';
  return () => keys.forEach((k, i) => { if (values[i] === undefined) delete process.env[k]; else process.env[k] = values[i]; });
}
const neverFetch: typeof fetch = async () => { throw new Error('Mock mode must not call network'); };
test('all scripted fixtures classify their reasoning and arithmetic slip remains none without network', async () => {
  const restore = env();
  try {
    const content = await loadPhysicsContent(); const classify = createReasoningClassifier({ fetchImpl: neverFetch, fixtureMode: true });
    const expected = ['m:current-consumed', 'm:angle-from-surface', 'm:denser-bends-away', 'none'];
    for (const [i, c] of cases.entries()) {
      const item = content.bank.find(q => q.id === c.itemId)!;
      const result = await classify({ item, answer: item.options!.find(o => o !== item.answer)!, reasoning: c.reasoning, correct: false }, content.misconceptions);
      assert.equal(result.tag, expected[i]); assert.equal(result.source, 'mock'); assert.equal(result.fallback, false);
      if (result.quote) assert.ok(c.reasoning.includes(result.quote));
    }
  } finally { restore(); }
});
test('arbitrary fixture reasoning is conservative; correct answers skip classification', async () => {
  const restore = env();
  try {
    const c = await loadPhysicsContent(); const item = c.bank.find(i => i.id === 'elec-05')!;
    const classify = createReasoningClassifier({ fetchImpl: neverFetch, fixtureMode: true });
    const result = await classify({ item, answer: 'wrong', reasoning: 'I am not sure.', correct: false }, c.misconceptions);
    assert.equal(result.tag, 'none'); assert.equal(result.source, 'mock');
    const correct = await classify({ item, answer: String(item.answer), reasoning: cases[0].reasoning, correct: true }, c.misconceptions);
    assert.equal(correct.source, 'not-needed'); assert.equal(correct.tag, 'none');
  } finally { restore(); }
});
test('closed-set validator rejects invented tags, quotes, nonfinite confidence and altered principles', async () => {
  const c = await loadPhysicsContent(); const item = c.bank.find(i => i.id === 'elec-05')!;
  const candidates = candidateMisconceptions(item, c.misconceptions); const tag = candidates[0];
  const reasoning = 'The current is used up by the first bulb';
  const valid = { tag: tag.id, confidence: 0.9, quote: reasoning, correctPrinciple: tag.correctPrinciple, remediationHint: tag.remediationHint };
  assert.equal(validateClassification(valid, candidates, reasoning), null);
  for (const change of [{ tag: 'm:myopia-convex' }, { quote: 'invented quote' }, { confidence: NaN }, { confidence: 1.2 }, { correctPrinciple: 'Current disappears.' }]) {
    assert.ok(validateClassification({ ...valid, ...change }, candidates, reasoning));
  }
  assert.ok(validateClassification({ ...valid, quote: 'word '.repeat(26).trim() }, candidates, 'word '.repeat(26)));
  assert.ok(c.bank.every(i => candidateMisconceptions(i, c.misconceptions).length <= 5));
});
test('live adapter passes relevant candidates through gateway and preserves live source', async () => {
  const restore = env('0');
  try {
    const c = await loadPhysicsContent(); const item = c.bank.find(i => i.id === 'elec-05')!;
    const tag = c.misconceptions.find(t => t.id === 'm:current-consumed')!;
    const classify = createReasoningClassifier({ fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body)); const input = JSON.parse(body.messages[1].content);
      assert.ok(input.candidates.every((t: { conceptIds: string[] }) => t.conceptIds.some(id => item.conceptIds.includes(id))));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ tag: tag.id, confidence: 0.9, quote: 'The current is used up', correctPrinciple: tag.correctPrinciple, remediationHint: tag.remediationHint }) } }] }));
    } });
    const result = await classify({ item, answer: 'wrong', reasoning: cases[0].reasoning, correct: false }, c.misconceptions);
    assert.equal(result.source, 'live'); assert.equal(result.attempts, 1); assert.ok(detectedMisconception(result));
  } finally { restore(); }
});
test('invalid live quotes retry then disclose contextual fixture fallback', async () => {
  const restore = env('0');
  try {
    const c = await loadPhysicsContent(); const item = c.bank.find(i => i.id === 'elec-05')!; let calls = 0;
    const classify = createReasoningClassifier({ fixtureMode: true, fetchImpl: async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ tag: 'm:current-consumed', confidence: 0.9, quote: 'fabricated', correctPrinciple: 'wrong', remediationHint: 'wrong' }) } }] })); } });
    const result = await classify({ item, answer: 'wrong', reasoning: cases[0].reasoning, correct: false }, c.misconceptions);
    assert.equal(calls, 2); assert.equal(result.source, 'mock'); assert.equal(result.fallback, true); assert.equal(result.tag, 'm:current-consumed');
  } finally { restore(); }
});
test('low-confidence diagnosis has no extra penalty; supported misconception does', () => {
  const ev = { correct: false, difficulty: 1 as const, at };
  const baseline = updateMastery(initialState(), ev);
  const low = updateMastery(initialState(), { ...ev, misconception: { tag: 'm:current-consumed', confidence: 0.54 } });
  const high = updateMastery(initialState(), { ...ev, misconception: { tag: 'm:current-consumed', confidence: 0.55 } });
  assert.equal(low.mastery, baseline.mastery); assert.ok(high.mastery < baseline.mastery);
});
test('Leitner intervals promote, hold, clamp and drop as specified', () => {
  let state = scheduleReview(undefined, { at, correct: true, mastery: 0.7, misconception: false });
  assert.equal(state.box, 1); assert.equal(state.dueAt, '2026-11-03T10:00:00.000Z');
  assert.equal(dueReviews({ c: state }, '2026-11-02T10:00:00Z').length, 0);
  assert.equal(dueReviews({ c: state }, '2026-11-03T10:00:00Z').length, 1);
  const held = scheduleReview(state, { at, correct: true, mastery: 0.6, misconception: false }); assert.equal(held.box, 1);
  for (let i = 0; i < 10; i++) state = scheduleReview(state, { at, correct: true, mastery: 0.9, misconception: false });
  assert.equal(state.box, 4); assert.equal(state.dueAt, '2026-12-30T10:00:00.000Z');
  state = scheduleReview(state, { at, correct: false, mastery: 0.5, misconception: false }); assert.equal(state.box, 2);
  state = scheduleReview(state, { at, correct: false, mastery: 0.4, misconception: true });
  assert.equal(state.box, 0); assert.equal(state.dueAt, '2026-11-01T10:00:00.000Z'); assert.equal(state.remediation, true);
  state = scheduleReview(state, { at, correct: true, mastery: 0.5, misconception: false }); assert.equal(state.remediation, false);
});
test('due and remediation hooks affect selection without forcing immediate repeats', async () => {
  const c = await loadPhysicsContent(); const base = c.bank.find(i => i.id === 'elec-05')!;
  const bank = [{ ...base, id: 'a', difficulty: 1 as const }, { ...base, id: 'b', difficulty: 3 as const }];
  const state = { 'elec:series-circuits': { ...initialState(), mastery: 0.8 }, 'elec:ohms-law': { ...initialState(), mastery: 0.8 } };
  const options = { now: at, recentIds: [] };
  assert.equal(rankQuestions(state, bank, c.graph, options)[0].item.id, 'b');
  const rem = { ...options, dueConceptIds: ['elec:series-circuits'], remediationConceptIds: ['elec:series-circuits'] };
  assert.equal(rankQuestions(state, bank, c.graph, rem)[0].item.id, 'a');
  const dueScore = rankQuestions(state, bank, c.graph, { ...options, dueConceptIds: ['elec:series-circuits'] })[0].score;
  assert.ok(Math.abs(dueScore - rankQuestions(state, bank, c.graph, options)[0].score - 0.18) < 1e-10);
  assert.equal(rankQuestions(state, bank, c.graph, { ...rem, recentIds: ['a'] })[0].item.id, 'b');
});
test('session persists misconception, source and SRS once; due status follows injected clock', async () => {
  const restore = env();
  try {
    const c = await loadPhysicsContent(); const store = createMemoryStore(); let clock = at;
    for (const concept of c.graph) {
      const mastery = concept.id === 'elec:series-circuits' ? 0.3 : 0.8;
      await store.put({ namespace: 'tutor.mastery', key: concept.id, at, sourceId: 'prior', value: { ...initialState(), mastery, logit: Math.log(mastery / (1 - mastery)) } });
    }
    const svc = createSessionService(store, c, { now: () => clock, classify: createReasoningClassifier({ fetchImpl: neverFetch, fixtureMode: true }) });
    let v = await svc.start('practice'); assert.equal(v.question?.id, 'elec-05'); const token = v.token;
    const item = c.bank.find(i => i.id === 'elec-05')!;
    const input = { token, answer: item.options!.find(o => o !== item.answer)!, reasoning: cases[0].reasoning };
    v = await svc.answer(input); assert.equal(v.feedback?.analysis?.tag, 'm:current-consumed');
    assert.equal(v.feedback?.analysis?.source, 'mock'); assert.equal(v.reviews[0].remediation, true);
    await svc.answer(input);
    assert.equal((await store.all('tutor.misconception')).length, 1);
    assert.equal((await store.latest('tutor.srs', 'elec:series-circuits'))?.version, 1);
    clock = '2026-11-01T10:00:00Z'; assert.equal((await svc.view()).reviews[0].due, true);
    const restored = await createSessionService(createMemoryStore(store.dump()), c).view();
    assert.equal(restored.feedback?.analysis?.source, 'mock'); assert.equal(restored.reviews.length, 1);
  } finally { restore(); }
});
test('low-confidence or unavailable analysis still saves wrong answer and revision without a tag', async () => {
  const c = await loadPhysicsContent();
  for (const source of ['live', 'unavailable'] as const) {
    const store = createMemoryStore();
    const analysis: ReasoningAnalysis = { ...noMisconception(), source, attempts: 0, fallback: false };
    const svc = createSessionService(store, c, { now: () => at, classify: async () => analysis });
    let v = await svc.start('practice'); const item = c.bank.find(i => i.id === v.question!.id)!;
    v = await svc.answer({ token: v.token, answer: item.options!.find(o => o !== item.answer)!, reasoning: 'Unsure.' });
    assert.ok(v.feedback!.changes[0].after < 0.5); assert.equal(v.reviews[0].remediation, false);
    assert.equal((await store.all('tutor.misconception')).length, 0);
  }
});
test('a diagnosis penalises and flags only the intersecting concept of a multi-concept question', async () => {
  const c = await loadPhysicsContent(); const store = createMemoryStore(); const item = c.bank.find(i => i.id === 'energy-05')!;
  const tag = c.misconceptions.find(t => t.id === 'm:solar-stores-power')!;
  await store.put({ namespace: 'tutor.session', key: 'demo', at, sourceId: 'test-session', value: {
    id: 'test-session', mode: 'practice', diagnosticIndex: 0, answered: 0, itemId: item.id, token: 'test-token', recentIds: [], feedback: null } });
  const svc = createSessionService(store, c, { now: () => at, classify: async () => ({ tag: tag.id, confidence: 0.9, quote: 'The solar cell stores energy.',
    correctPrinciple: tag.correctPrinciple, remediationHint: tag.remediationHint, source: 'live', attempts: 1, fallback: false }) });
  const v = await svc.answer({ token: 'test-token', answer: item.options!.find(o => o !== item.answer), reasoning: 'The solar cell stores energy.' });
  const baseline = updateMastery(initialState(), { at, correct: false, difficulty: item.difficulty, conceptCount: 2 });
  assert.equal(v.feedback?.changes.find(n => n.conceptId === 'elec:power-energy')?.after, baseline.mastery);
  assert.ok(v.feedback!.changes.find(n => n.conceptId === 'energy:solar')!.after < baseline.mastery);
  assert.equal(v.reviews.find(r => r.conceptId === 'energy:solar')?.remediation, true);
  assert.equal(v.reviews.find(r => r.conceptId === 'elec:power-energy')?.remediation, false);
});
