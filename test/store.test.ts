import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStore } from '../src/platform/store/memory';
import type { Fact } from '../src/platform/types';

const mastery = (at: string, value: number, sourceId = 'attempt-1') => ({
  namespace: 'tutor.mastery',
  key: 'elec:series-circuits',
  value: { logit: value, mastery: 1 / (1 + Math.exp(-value)) },
  at,
  sourceId,
});

test('each answer writes a new version of the same concept and latest reflects it', async () => {
  const store = createMemoryStore();
  const v1 = await store.put(mastery('2026-10-31T10:00:00Z', 0.2));
  const v2 = await store.put(mastery('2026-10-31T10:04:00Z', -0.3, 'attempt-2'));

  assert.equal(v1.version, 1);
  assert.equal(v2.version, 2);

  const latest = await store.latest<{ mastery: number }>('tutor.mastery', 'elec:series-circuits');
  assert.equal(latest?.version, 2);
  assert.ok(latest && latest.value.mastery < 0.5, 'a wrong answer must lower the mastery the UI reads');
});

test('history is the full evidence trail for one concept, oldest first', async () => {
  const store = createMemoryStore();
  await store.put(mastery('2026-10-31T10:00:00Z', 0.2));
  await store.put(mastery('2026-10-31T10:04:00Z', -0.3, 'attempt-2'));
  const history = await store.history('tutor.mastery', 'elec:series-circuits');
  assert.deepEqual(history.map((f) => f.version), [1, 2]);
  assert.deepEqual(history.map((f) => f.sourceId), ['attempt-1', 'attempt-2']);
});

test('all returns one entry per concept, and before reconstructs an earlier learner state', async () => {
  const store = createMemoryStore();
  await store.put(mastery('2026-10-31T10:00:00Z', 0.2));
  await store.put(mastery('2026-10-31T10:04:00Z', -0.3, 'attempt-2'));
  await store.put({ ...mastery('2026-10-31T10:02:00Z', 0.8), key: 'light:refraction' });

  const now = await store.all('tutor.mastery');
  assert.equal(now.length, 2);

  const earlier = await store.all<{ mastery: number }>('tutor.mastery', {
    before: '2026-10-31T10:03:00Z',
  });
  assert.equal(earlier.find((f) => f.key === 'elec:series-circuits')?.version, 1);
});

test('reset of the cohort namespace leaves the learner model untouched', async () => {
  const store = createMemoryStore();
  await store.put(mastery('2026-10-31T10:00:00Z', 0.2));
  await store.put({ ...mastery('2026-10-31T10:00:00Z', 0.2), namespace: 'tutor.cohort.demo' });
  await store.reset('tutor.cohort.demo');
  assert.equal((await store.all('tutor.cohort.demo')).length, 0);
  assert.equal((await store.all('tutor.mastery')).length, 1);
  assert.deepEqual(await store.namespaces(), ['tutor.mastery']);
});

test('rehydrating from a dump continues version numbering', async () => {
  const first = createMemoryStore();
  await first.put(mastery('2026-10-31T10:00:00Z', 0.2));
  const restored = createMemoryStore(first.dump() as Fact[]);
  const next = await restored.put(mastery('2026-10-31T10:04:00Z', -0.3, 'attempt-2'));
  assert.equal(next.version, 2);
});
