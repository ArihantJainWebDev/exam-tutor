import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { signIdentity, verifyIdentity } from '../src/lib/identity';
import { createMemoryStore } from '../src/platform/store/memory';
import { learnerStore } from '../src/platform/store/scoped';
import { loadPhysicsContent } from '../src/lib/content.server';
import { initialState } from '../src/lib/mastery';
import { teachingDecision } from '../src/lib/teaching';
import { noMisconception, type ReasoningAnalysis } from '../src/lib/misconception';
import { buildGeneratedQuestion, questionPlanSchema } from '../src/lib/generated-question';
import { createSessionService } from '../src/app/tutor/session-service';
import { loadRealCohort } from '../src/app/tutor/teacher/real-cohort';
import { callLlm } from '../src/platform/llm';

test('signed identities reject tampering, expiry and wrong secrets', () => {
  const secret = 'test-session-secret-with-at-least-32-characters';
  const identity = { id: randomUUID(), role: 'learner' as const, cohort: 'physics', expires: 2000 };
  const token = signIdentity(identity, secret);
  assert.deepEqual(verifyIdentity(token, secret, 1000), identity);
  assert.equal(verifyIdentity(token, secret, 3000), null);
  assert.equal(verifyIdentity(token + 'x', secret, 1000), null);
  assert.equal(verifyIdentity(token, secret + 'wrong', 1000), null);
  const forged = Buffer.from(JSON.stringify({ ...identity, role: 'teacher' })).toString('base64url') + '.' + token.split('.')[1];
  assert.equal(verifyIdentity(forged, secret, 1000), null);
});
test('personal namespaces isolate read/history/reset and never expose legacy demo evidence', async () => {
  const root = createMemoryStore(), a = learnerStore(root, randomUUID()), b = learnerStore(root, randomUUID());
  await root.put({ namespace: 'tutor.mastery', key: 'legacy', value: 1, at: '2026-10-31', sourceId: 'legacy' });
  await a.put({ namespace: 'tutor.mastery', key: 'c', value: 0.8, at: '2026-10-31', sourceId: 'a' });
  await b.put({ namespace: 'tutor.mastery', key: 'c', value: 0.2, at: '2026-10-31', sourceId: 'b' });
  assert.equal((await a.latest('tutor.mastery', 'c'))?.value, 0.8);
  assert.equal((await b.latest('tutor.mastery', 'c'))?.value, 0.2);
  assert.equal((await a.all('tutor.mastery')).length, 1);
  await a.reset(); assert.equal((await a.namespaces()).length, 0);
  assert.equal((await b.history('tutor.mastery', 'c')).length, 1); assert.equal((await root.all('tutor.mastery')).length, 1);
});
test('same wrong answer with different reasoning chooses different teaching actions', () => {
  const base: ReasoningAnalysis = { ...noMisconception(), source: 'live', attempts: 1, fallback: false };
  const misconception = teachingDecision({ correct: false, conceptId: 'light:reflection', analysis: { ...base, reasoningKind: 'misconception', tag: 'm:angle-from-surface', confidence: 0.9 } });
  const slip = teachingDecision({ correct: false, conceptId: 'light:reflection', analysis: { ...base, reasoningKind: 'slip' } });
  const uncertain = teachingDecision({ correct: false, conceptId: 'light:reflection', analysis: { ...base, reasoningKind: 'uncertain' } });
  assert.equal(misconception.action, 'correct-misconception'); assert.equal(slip.action, 'check-calculation'); assert.equal(uncertain.action, 'clarify');
});
test('physics solvers own keys, reject malformed plans and derive identity from rendered content', () => {
  const q = buildGeneratedQuestion({ family: 'reflection-angle', variant: 'b', parameters: { angle: 35 } }, 'light:reflection', 1);
  assert.equal(q.answer, '55 degrees'); assert.equal(new Set(q.options).size, 4); assert.ok(q.options?.includes(String(q.answer)));
  const equivalent = buildGeneratedQuestion({ family: 'reflection-angle', variant: 'b', parameters: { angle: 35, unused: 999 } }, 'light:reflection', 1);
  assert.equal(q.id, equivalent.id);
  assert.equal(buildGeneratedQuestion({ family: 'ohms-law', variant: 'a', parameters: { voltage: 12, resistance: 4 } }, 'elec:ohms-law', 1).answer, '3 A');
  assert.equal(buildGeneratedQuestion({ family: 'lens-power', variant: 'b', parameters: { focalLengthCm: 50 } }, 'light:lens-power', 1).answer, '-2 D');
  assert.throws(() => buildGeneratedQuestion({ family: 'reflection-angle', variant: 'a', parameters: { angle: 999 } }, 'light:reflection', 1));
  assert.throws(() => buildGeneratedQuestion({ family: 'reflection-angle', variant: 'a', parameters: { angle: 30 } }, 'elec:ohms-law', 1));
});
test('live correction needs two distinct coherent transfer answers before improvement is observed', async () => {
  const content = await loadPhysicsContent(); const store = createMemoryStore();
  await store.put({ namespace: 'tutor.session', key: 'demo', at: '2026-10-31', sourceId: 'test', value: { id: 's', mode: 'practice', diagnosticIndex: 0,
    answered: 0, itemId: 'light-01', token: 't', recentIds: [], feedback: null, purpose: 'practice' } });
  const tag = content.misconceptions.find(t => t.id === 'm:angle-from-surface')!; let calls = 0, angle = 35;
  const svc = createSessionService(store, content, {
    classify: async input => ++calls === 1 ? { tag: tag.id, reasoningKind: 'misconception', confidence: 0.95, quote: input.reasoning,
      correctPrinciple: tag.correctPrinciple, remediationHint: tag.remediationHint, source: 'live', attempts: 1, fallback: false }
      : { ...noMisconception(), reasoningKind: 'sound', reasoningConfidence: 0.95, source: 'live', attempts: 1, fallback: false },
    generate: async input => { assert.equal(input.misconceptionTag, tag.id); const q = buildGeneratedQuestion({ family: 'reflection-angle', variant: 'b', parameters: { angle }, task: input.task }, input.conceptId, 1); angle += 5; return q; },
  });
  let v = await svc.answer({ token: 't', answer: '30 degrees', reasoning: 'I measured from the surface.' });
  assert.equal(v.feedback?.decision?.action, 'correct-misconception'); assert.equal(v.learning[0].status, 'verification-needed');
  for (let step = 0; step < 2; step++) {
    v = await svc.advance(v.token); assert.equal(v.questionSource, 'live-generated');
    const q = (await store.latest<{ answer: string }>('tutor.generated', v.question!.id))!.value;
    v = await svc.answer({ token: v.token, answer: q.answer, reasoning: 'The normal is perpendicular, so the angles add to 90 degrees.' });
    assert.equal(v.learning[0].successfulChecks, step + 1);
    assert.equal(v.learning[0].status, step === 0 ? 'verification-needed' : 'improvement-observed');
  }
  assert.equal(v.feedback?.decision?.action, 'advance');
});
test('a correct option with contradictory reasoning does not receive an ordinary correctness reward', async () => {
  const c = await loadPhysicsContent(); const store = createMemoryStore(); const tag = c.misconceptions.find(t => t.id === 'm:angle-from-surface')!;
  await store.put({ namespace: 'tutor.session', key: 'demo', at: '2026-10-31', sourceId: 'test', value: { id: 's', mode: 'practice', diagnosticIndex: 0,
    answered: 0, itemId: 'light-01', token: 't', recentIds: [], feedback: null } });
  const svc = createSessionService(store, c, { classify: async input => ({ tag: tag.id, confidence: 0.9, reasoningKind: 'misconception', quote: input.reasoning,
    correctPrinciple: tag.correctPrinciple, remediationHint: tag.remediationHint, source: 'live', attempts: 1, fallback: false }) });
  const v = await svc.answer({ token: 't', answer: '60 degrees', reasoning: 'I measure incidence from the mirror surface.' });
  assert.equal(v.feedback?.correct, true); assert.ok(v.feedback!.changes[0].after < 0.5); assert.equal(v.learning[0].status, 'verification-needed');
});
test('generation failure remains visible and retains saved answer without fixture substitution', async () => {
  const c = await loadPhysicsContent(); const store = createMemoryStore();
  await store.put({ namespace: 'tutor.session', key: 'demo', at: '2026-10-31', sourceId: 'test', value: { id: 's', mode: 'practice', diagnosticIndex: 0,
    answered: 0, itemId: 'light-01', token: 't', recentIds: [], feedback: null } });
  const svc = createSessionService(store, c, { classify: async () => ({ ...noMisconception(), reasoningKind: 'uncertain', source: 'live', attempts: 1, fallback: false }),
    generate: async () => { throw new Error('network unavailable'); } });
  await svc.answer({ token: 't', answer: '30 degrees', reasoning: 'Unsure.' });
  const view = await svc.advance('t'); assert.match(view.notice!, /Groq/); assert.equal(view.answered, 1);
  assert.equal((await store.all('tutor.generated')).length, 0);
});
test('a failed next-question request cannot replay the previous answer into a second verification', async () => {
  const c = await loadPhysicsContent(); const store = createMemoryStore();
  const q = buildGeneratedQuestion({ family: 'reflection-angle', variant: 'b', parameters: { angle: 35 } }, 'light:reflection', 1);
  await store.put({ namespace: 'tutor.generated', key: q.id, value: q, at: '2026-10-31', sourceId: 'test' });
  await store.put({ namespace: 'tutor.learning', key: 'light:reflection', value: { status: 'verification-needed', tag: 'm:angle-from-surface', lastAttemptId: 'prior', successfulChecks: 0 }, at: '2026-10-31', sourceId: 'prior' });
  await store.put({ namespace: 'tutor.session', key: 'demo', at: '2026-10-31', sourceId: 'test', value: { id: 's', mode: 'practice', diagnosticIndex: 0, answered: 0, itemId: q.id, token: 't', recentIds: [], feedback: null, purpose: 'verification' } });
  const svc = createSessionService(store, c, { classify: async () => ({ ...noMisconception(), reasoningKind: 'sound', reasoningConfidence: 0.95, source: 'live', attempts: 1, fallback: false }),
    generate: async () => { throw new Error('duplicate or unavailable'); } });
  await svc.answer({ token: 't', answer: q.answer, reasoning: q.explanation });
  const failed = await svc.advance('t'); assert.equal(failed.token, 't'); assert.ok(failed.notice);
  const retried = await svc.answer({ token: 't', answer: q.answer, reasoning: q.explanation });
  assert.equal(retried.learning[0].successfulChecks, 1); assert.equal(retried.learning[0].status, 'verification-needed');
  assert.equal((await store.all('tutor.attempt')).length, 1);
});
test('teacher summaries include only real enrolled learners in the authorised cohort', async () => {
  const store = createMemoryStore(); const a = randomUUID(), b = randomUUID();
  for (const [id, cohort] of [[a, 'physics'], [b, 'other']]) await store.put({ namespace: 'learners.profile', key: id,
    value: { id, cohort, label: id.slice(0, 6) }, at: '2026-10-31', sourceId: id });
  await learnerStore(store, a).put({ namespace: 'tutor.mastery', key: 'elec:current', value: { ...initialState(), attempts: 1 }, at: '2026-10-31', sourceId: 'a1' });
  const cohort = await loadRealCohort(store, 'physics'); assert.equal(cohort.length, 1); assert.equal(cohort[0].id, a);
  assert.equal(cohort[0].states['elec:current'].attempts, 1); assert.equal(cohort[0].attempts.length, 0);
});
test('an unsupported clarification does not silently skip the next diagnostic chapter', async () => {
  const content = await loadPhysicsContent(); const store = createMemoryStore();
  const service = createSessionService(store, content, { generate: async () => null,
    classify: async () => ({ ...noMisconception(), reasoningKind: 'uncertain', reasoningConfidence: 0.2, source: 'live', attempts: 1, fallback: false }) });
  let v = await service.start('diagnostic');
  await service.answer({ token: v.token, answer: '18 A', reasoning: 'I guessed.' });
  v = await service.advance(v.token);
  assert.equal(v.question?.id, 'light-01'); assert.equal(v.purpose, 'diagnostic'); assert.equal(v.diagnosticIndex, 1);
});
test('product gateway refuses fixture fallback even when MOCK_LLM is set', async () => {
  const oldKey = process.env.LLM_API_KEY, oldMode = process.env.MOCK_LLM;
  try { delete process.env.LLM_API_KEY; process.env.MOCK_LLM = '1';
    await assert.rejects(callLlm({ prompt: 'tutor.classify', input: {} }), /Live model access is required/);
  } finally { if (oldKey === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = oldKey;
    if (oldMode === undefined) delete process.env.MOCK_LLM; else process.env.MOCK_LLM = oldMode; }
});


test('reflection surface angle 50 is independently graded as incidence 40, not 50', async () => {
  const content = await loadPhysicsContent();
  const q = buildGeneratedQuestion({ family: 'reflection-angle', variant: 'a', parameters: { angle: 50 } }, 'light:reflection', 1);
  assert.equal(q.answer, '40 degrees');
  for (const [choice, expected] of [['40 degrees', true], ['50 degrees', false]] as const) {
    const store = createMemoryStore();
    await store.put({ namespace: 'tutor.generated', key: q.id, value: q, at: '2026-10-31', sourceId: 'test' });
    await store.put({ namespace: 'tutor.session', key: 'demo', value: { id: 's', mode: 'practice', diagnosticIndex: 0,
      answered: 0, itemId: q.id, token: 't', recentIds: [], feedback: null }, at: '2026-10-31', sourceId: 'test' });
    const svc = createSessionService(store, content, { classify: async () => ({ ...noMisconception(), source: 'live', attempts: 1, fallback: false }) });
    assert.equal((await svc.answer({ token: 't', answer: choice, reasoning: 'Angles to surface and normal add to 90.' })).feedback?.correct, expected);
  }
});


test('generation schema constrains lowercase variants and excludes used reflection angles', () => {
  const schema = questionPlanSchema(['reflection-angle'], [{ family: 'reflection-angle', parameters: { angle: 35 } }]) as {
    properties: { variant: { enum: string[] }; parameters: { properties: { angle: { enum: number[] } } } };
  };
  assert.deepEqual(schema.properties.variant.enum, ['a', 'b']);
  assert.ok(!schema.properties.parameters.properties.angle.enum.includes(35));
  assert.ok(!schema.properties.parameters.properties.angle.enum.includes(45));
  assert.ok(schema.properties.parameters.properties.angle.enum.includes(50));
});
