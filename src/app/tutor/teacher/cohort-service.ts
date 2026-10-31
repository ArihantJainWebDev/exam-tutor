import { createHash } from 'node:crypto';
import type { Fact, MemoryStore } from '@/platform/types';
import type { PhysicsContent } from '@/lib/content';
import { COHORT_SEED, COHORT_VERSION, simulateClass, type SimulatedLearner } from '@/lib/cohort';
import { withStoreTransaction } from '@/platform/store/provider';

export const COHORT_NAMESPACE = 'tutor.cohort.demo';
const globals = globalThis as typeof globalThis & { __redpenCohortLoads?: WeakMap<MemoryStore, Promise<Fact<SimulatedLearner>[]>> };
/** Initialisation touches only teacher records, preserving practice progress. */
export async function loadTeacherCohort(store: MemoryStore, content: PhysicsContent): Promise<Fact<SimulatedLearner>[]> {
  globals.__redpenCohortLoads ??= new WeakMap();
  const active = globals.__redpenCohortLoads.get(store);
  if (active) return active;
  const work = withStoreTransaction(store, async store => {
    const signature = createHash('sha256').update(JSON.stringify({ content, seed: COHORT_SEED, version: COHORT_VERSION })).digest('hex');
    const meta = await store.latest<{ signature: string }>('tutor.cohort.meta', 'demo');
    const existing = await store.all<SimulatedLearner>(COHORT_NAMESPACE);
    if (meta?.value.signature === signature && existing.length === 20) return existing;
    await store.reset(COHORT_NAMESPACE);
    const facts = [];
    for (const learner of simulateClass(content)) facts.push(await store.put({ namespace: COHORT_NAMESPACE, key: learner.id,
      value: learner, at: learner.attempts.at(-1)!.at, sourceId: `simulation:${COHORT_SEED}:v${COHORT_VERSION}` }));
    await store.put({ namespace: 'tutor.cohort.meta', key: 'demo', at: new Date().toISOString(), sourceId: `simulation:${COHORT_SEED}`,
      value: { signature, seed: COHORT_SEED, version: COHORT_VERSION, learners: facts.length, synthetic: true } });
    return facts;
  });
  globals.__redpenCohortLoads.set(store, work);
  try { return await work; } finally { globals.__redpenCohortLoads.delete(store); }
}
