'use server';
import { getStore } from '@/platform';
import { loadPhysicsContent } from '@/lib/content.server';
import { createSessionService } from './session-service';

const shared = globalThis as typeof globalThis & { __redpenMutationQueue?: Promise<unknown> };
async function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = (shared.__redpenMutationQueue ?? Promise.resolve()).then(work, work);
  shared.__redpenMutationQueue = result.catch(() => undefined);
  return result;
}
async function service() { return createSessionService(getStore(), await loadPhysicsContent()); }
export async function startSession(mode: 'diagnostic' | 'practice') {
  return serial(async () => (await service()).start(mode));
}
export async function submitAnswer(token: string, answer: string, reasoning: string) {
  return serial(async () => (await service()).answer({ token, answer, reasoning }));
}
export async function nextItem(token: string) {
  return serial(async () => (await service()).advance(token));
}
