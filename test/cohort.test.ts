import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPhysicsContent } from '../src/lib/content.server';
import { COHORT_SEED, simulateClass, summarizeClass } from '../src/lib/cohort';
import { initialState, updateMastery, type State } from '../src/lib/mastery';
import { createMemoryStore } from '../src/platform/store/memory';
import { COHORT_NAMESPACE, loadTeacherCohort } from '../src/app/tutor/teacher/cohort-service';

test('cohort is deterministic for seed, covers all concepts and replays 40 answers per learner', async () => {
  const c = await loadPhysicsContent(); const learners = simulateClass(c);
  assert.deepEqual(learners, simulateClass(c)); assert.notDeepEqual(learners, simulateClass(c, 20, COHORT_SEED + 1));
  assert.equal(learners.length, 20);
  assert.ok(learners.every(l => l.attempts.length === 40 && c.graph.every(n => l.states[n.id]?.attempts > 0)));
});
test('simulated mastery exactly matches independent replay through the existing update function', async () => {
  const c = await loadPhysicsContent(); const learner = simulateClass(c, 1)[0]; const state: Record<string, State> = {};
  for (const a of learner.attempts) {
    const item = c.bank.find(i => i.id === a.itemId)!;
    const tag = c.misconceptions.find(t => t.id === a.misconception?.tag);
    for (const id of a.conceptIds) state[id] = updateMastery(state[id] ?? initialState(), {
      correct: a.correct, difficulty: item.difficulty, at: a.at, conceptCount: a.conceptIds.length,
      misconception: tag?.conceptIds.includes(id) ? a.misconception : undefined,
    });
  }
  assert.deepEqual(learner.states, state);
});
test('weak learners estimate below 50% on most concepts and strong group ranks above shaky', async () => {
  const c = await loadPhysicsContent(); const learners = simulateClass(c);
  const weak = learners.filter(l => l.archetype === 'shaky');
  for (const l of weak) assert.ok(Object.values(l.states).filter(s => s.mastery < 0.5).length / c.graph.length >= 0.6);
  const average = (group: typeof learners) => group.flatMap(l => Object.values(l.states)).reduce((s, n) => s + n.mastery, 0) / (group.length * c.graph.length);
  assert.ok(average(learners.filter(l => l.archetype === 'strong')) > average(weak));
});
test('summary derives heatmap, gap means, tag counts and supported risk flags from evidence', async () => {
  const c = await loadPhysicsContent(); const learners = simulateClass(c); const s = summarizeClass(learners, c);
  assert.equal(s.totalAnswers, 800); assert.equal(s.gaps.length, 24); assert.ok(s.atRisk.length > 0);
  for (const gap of s.gaps) {
    assert.equal(gap.mean, learners.reduce((sum, l) => sum + l.states[gap.conceptId].mastery, 0) / learners.length);
    assert.equal(s.values[gap.conceptId][learners[0].id], learners[0].states[gap.conceptId].mastery);
  }
  for (const risk of s.atRisk) for (const concept of risk.concepts) {
    const state = learners.find(l => l.id === risk.id)!.states[concept.id]; assert.ok(state.mastery < 0.35 && state.confidence > 0.6);
  }
  assert.equal(s.misconceptions.reduce((sum, m) => sum + m.count, 0), learners.flatMap(l => l.attempts).filter(a => a.misconception).length);
  assert.ok(s.gaps.every((g, i) => i === 0 || (s.gaps[i - 1].mean ?? 1) <= (g.mean ?? 1)));
});
test('empty and partial evidence stays unobserved rather than receiving invented scores', async () => {
  const c = await loadPhysicsContent(); const s = summarizeClass([], c);
  assert.ok(s.gaps.every(g => g.mean === null && g.observed === 0)); assert.deepEqual(s.atRisk, []);
});
test('teacher initialisation is idempotent, concurrent-safe per process and preserves practice facts', async () => {
  const content = await loadPhysicsContent(); const store = createMemoryStore();
  await store.put({ namespace: 'tutor.mastery', key: 'elec:current', value: initialState(), at: '2026-10-31', sourceId: 'practice' });
  const [a, b] = await Promise.all([loadTeacherCohort(store, content), loadTeacherCohort(store, content)]);
  assert.equal(a.length, 20); assert.deepEqual(a, b);
  const again = await loadTeacherCohort(store, content); assert.ok(again.every(f => f.version === 1));
  assert.equal((await store.all('tutor.mastery')).length, 1);
  assert.equal((await store.all(COHORT_NAMESPACE)).length, 20);
  const restored = createMemoryStore(store.dump());
  assert.deepEqual(await loadTeacherCohort(restored, content), again);
});
