import type { MemoryStore } from '@/platform/types';
import { learnerStore } from '@/platform/store/scoped';
import { withStoreTransaction } from '@/platform';
import type { State } from '@/lib/mastery';
import type { SimulatedAttempt } from '@/lib/cohort';
export interface RealLearner { id: string; label: string; states: Record<string, State>; attempts: SimulatedAttempt[] }
export async function loadRealCohort(store: MemoryStore, cohort: string, personal?: (id: string) => MemoryStore): Promise<RealLearner[]> {
  return withStoreTransaction(store, async snapshot => {
    const profiles = (await snapshot.all<{ id: string; label: string; cohort: string }>('learners.profile')).filter(f => f.value.cohort === cohort);
    return Promise.all(profiles.map(async profile => {
      const scoped = personal ? personal(profile.value.id) : learnerStore(snapshot, profile.value.id);
      const states = Object.fromEntries((await scoped.all<State>('tutor.mastery')).map(f => [f.key, f.value]));
      const records = await scoped.all<{ itemId: string; conceptIds: string[]; correct: boolean; analysis?: { tag: string; confidence: number; source: string } }>('tutor.attempt');
      return { id: profile.value.id, label: profile.value.label, states, attempts: records.map(f => ({ id: f.key,
        itemId: f.value.itemId, conceptIds: f.value.conceptIds, correct: f.value.correct, at: f.at,
        ...(f.value.analysis?.source === 'live' && f.value.analysis.tag !== 'none' && f.value.analysis.confidence >= 0.55 ? { misconception: { tag: f.value.analysis.tag, confidence: f.value.analysis.confidence } } : {}) })) };
    }));
  });
}
