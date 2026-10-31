'use server';
import { getStore, withStoreTransaction } from '@/platform';
import { loadPhysicsContent } from '@/lib/content.server';
import { createSessionService, type SessionView } from './session-service';
import { ensureLearner } from './auth';
import { getPersonalStore } from '@/platform/store/provider';

const shared = globalThis as typeof globalThis & { __redpenMutationQueue?: Promise<unknown> };
async function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = (shared.__redpenMutationQueue ?? Promise.resolve()).then(work, work);
  shared.__redpenMutationQueue = result.catch(() => undefined);
  return result;
}
async function mutate(work: (service: ReturnType<typeof createSessionService>) => Promise<SessionView>) {
  return serial(async () => {
    const content = await loadPhysicsContent();
    const identity = await ensureLearner();
    await withStoreTransaction(getStore(), async store => {
      if (!await store.latest('learners.profile', identity.id)) await store.put({ namespace: 'learners.profile', key: identity.id,
        value: { id: identity.id, label: `Learner ${identity.id.slice(0, 6)}`, cohort: identity.cohort }, at: new Date().toISOString(), sourceId: identity.id });
      const window = Math.floor(Date.now() / 60000).toString();
      const previous = await store.latest<number>('limits.requests', `${identity.id}:${window}`);
      if ((previous?.value ?? 0) >= 15) throw new Error('Too many requests. Please wait a minute.');
      await store.put({ namespace: 'limits.requests', key: `${identity.id}:${window}`, value: (previous?.value ?? 0) + 1, at: new Date().toISOString(), sourceId: identity.id });
    });
    return withStoreTransaction(getPersonalStore(identity.id), store => work(createSessionService(store, content)));
  });
}
export async function startSession(mode: 'diagnostic' | 'practice') {
  return mutate(service => service.start(mode));
}
export async function submitAnswer(token: string, answer: string, reasoning: string) {
  return mutate(service => service.answer({ token, answer, reasoning }));
}
export async function nextItem(token: string) {
  return mutate(service => service.advance(token));
}
export async function resetMyProgress() {
  const identity = await ensureLearner();
  return serial(() => withStoreTransaction(getPersonalStore(identity.id), async store => {
    await store.reset();
    return createSessionService(store, await loadPhysicsContent()).view();
  }));
}
