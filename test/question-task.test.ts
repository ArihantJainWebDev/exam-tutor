import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGeneratedQuestion } from '../src/lib/generated-question';
import { chooseQuestionTask, QUESTION_TASKS } from '../src/lib/question-task';
import { createMemoryStore } from '../src/platform/store/memory';
import { loadPhysicsContent } from '../src/lib/content.server';
import { noMisconception } from '../src/lib/misconception';
import { createSessionService } from '../src/app/tutor/session-service';

test('task policy responds to conceptual confusion, unclear reasoning and calculation slips', () => {
  assert.equal(chooseQuestionTask('correct-misconception', []), 'explain-error');
  assert.equal(chooseQuestionTask('clarify', []), 'identify-principle');
  assert.equal(chooseQuestionTask('check-calculation', []), 'calculate');
  assert.equal(chooseQuestionTask('verify-understanding', ['explain-error']), 'apply');
  assert.equal(chooseQuestionTask('verify-understanding', ['apply']), 'calculate');
  assert.notEqual(chooseQuestionTask('correct-misconception', ['explain-error']), 'explain-error');
});

test('all supported physics families render four distinct tasks with unique, gradeable options', () => {
  const cases = [
    ['ohms-law', 'elec:ohms-law', { voltage: 12, resistance: 4, current: 3 }],
    ['series-current', 'elec:series-circuits', { charge: 12, time: 3, bulbs: 3 }],
    ['series-voltage', 'elec:series-circuits', { voltage: 12, resistance1: 2, resistance2: 4 }],
    ['reflection-angle', 'light:reflection', { angle: 50 }],
    ['lens-power', 'light:lens-power', { focalLengthCm: 50 }],
    ['power-energy', 'elec:power-energy', { powerWatts: 1000, hours: 2 }],
    ['myopia', 'eye:vision-defects', { farPointMetres: 4 }],
  ] as const;
  // Separate arithmetic expectations for the changed situations, independent of renderer output.
  const expectedApply = ['6 A', '0 A', '9.6 V', '80 degrees', '4 D', '12 rupees', '-0.5 D'];
  for (const [index, [family, concept, parameters]] of cases.entries()) {
    const items = QUESTION_TASKS.map(task => buildGeneratedQuestion({ family, variant: 'a', parameters, task }, concept, 1));
    assert.equal(new Set(items.map(q => q.stem)).size, 4);
    assert.equal(new Set(items.map(q => q.id)).size, 4);
    for (const q of items) {
      assert.equal(q.options?.length, 4, family);
      assert.equal(new Set(q.options).size, 4, family);
      assert.ok(q.options?.includes(String(q.answer)), family);
      assert.ok(q.explanation && q.reasoningPrompt);
    }
    assert.equal(items.find(q => q.origin.task === 'apply')?.answer, expectedApply[index], family);
  }
  assert.equal(buildGeneratedQuestion({ family: 'lens-power', variant: 'b', parameters: { focalLengthCm: 50 }, task: 'apply' }, 'light:lens-power', 1).answer, '-4 D');
});

test('reflection error explanation and laser-path application assess different reasoning', () => {
  const plan = { family: 'reflection-angle', variant: 'a', parameters: { angle: 50 } };
  const error = buildGeneratedQuestion({ ...plan, task: 'explain-error' }, 'light:reflection', 1);
  const transfer = buildGeneratedQuestion({ ...plan, task: 'apply' }, 'light:reflection', 1);
  assert.match(String(error.answer), /normal/);
  assert.match(transfer.stem, /incident and reflected ray paths/);
  assert.equal(transfer.answer, '80 degrees');
  assert.notEqual(error.origin.signature, transfer.origin.signature);
  assert.throws(() => buildGeneratedQuestion({ ...plan, task: 'invent-an-answer' }, 'light:reflection', 1));
});

test('two numeric variants cannot resolve a misconception, but a different task can', async () => {
  const store = createMemoryStore(), content = await loadPhysicsContent();
  await store.put({ namespace: 'tutor.learning', key: 'light:reflection', at: '2026-10-31', sourceId: 'test',
    value: { status: 'verification-needed', tag: 'm:angle-from-surface', successfulChecks: 0, lastAttemptId: 'old' } });
  for (const [index, task] of ['calculate', 'calculate', 'apply'].entries()) {
    const q = buildGeneratedQuestion({ family: 'reflection-angle', variant: 'a', parameters: { angle: 30 + index * 5 }, task }, 'light:reflection', 1);
    await store.put({ namespace: 'tutor.generated', key: q.id, value: q, at: '2026-10-31', sourceId: 'test' });
    await store.put({ namespace: 'tutor.session', key: 'demo', at: '2026-10-31', sourceId: 'test', value: { id: 's', mode: 'practice', diagnosticIndex: 0,
      answered: index, itemId: q.id, token: `t${index}`, recentIds: [], feedback: null, purpose: 'verification' } });
    const svc = createSessionService(store, content, { classify: async () => ({ ...noMisconception(), source: 'live', attempts: 1,
      fallback: false, reasoningKind: 'sound', reasoningConfidence: 0.95 }), generate: async () => null });
    const v = await svc.answer({ token: `t${index}`, answer: String(q.answer), reasoning: q.explanation });
    assert.equal(v.learning[0].successfulChecks, index === 2 ? 2 : 1);
    assert.equal(v.learning[0].status, index === 2 ? 'improvement-observed' : 'verification-needed');
    if (index === 2) {
      const next = await svc.advance(v.token);
      assert.ok(!next.question?.conceptIds.includes('light:reflection'), 'Move to another learning priority after improvement');
    }
  }
});

test('legacy saved verification resumes without falsely assuming diverse prior evidence', async () => {
  const store = createMemoryStore(), content = await loadPhysicsContent();
  const q = buildGeneratedQuestion({ family: 'reflection-angle', variant: 'a', parameters: { angle: 50 } }, 'light:reflection', 1);
  await store.put({ namespace: 'tutor.generated', key: q.id, value: q, at: '2026-10-31', sourceId: 'test' });
  await store.put({ namespace: 'tutor.learning', key: 'light:reflection', at: '2026-10-31', sourceId: 'test',
    value: { status: 'verification-needed', tag: 'm:angle-from-surface', successfulChecks: 1, lastAttemptId: 'old' } });
  await store.put({ namespace: 'tutor.session', key: 'demo', at: '2026-10-31', sourceId: 'test', value: { id: 's', mode: 'practice', diagnosticIndex: 0,
    answered: 1, itemId: q.id, token: 't', recentIds: [], feedback: null, purpose: 'verification' } });
  const svc = createSessionService(store, content, { classify: async () => ({ ...noMisconception(), source: 'live', attempts: 1, fallback: false,
    reasoningKind: 'sound', reasoningConfidence: 0.95 }) });
  const v = await svc.answer({ token: 't', answer: String(q.answer), reasoning: q.explanation });
  assert.equal(v.learning[0].successfulChecks, 1);
  assert.equal(v.learning[0].status, 'verification-needed');
});
