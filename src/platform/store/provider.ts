import { getStore as getFileStore } from './file';
import { createRedisStore, type TransactionalStore } from './redis';
import type { MemoryStore } from '../types';
import { learnerStore } from './scoped';

const globalStores = globalThis as typeof globalThis & { __redpenRedisStores?: Map<string, TransactionalStore> };
export function getStore(filePath?: string): MemoryStore {
  if (filePath) return getFileStore(filePath);
  const mode = process.env.REDPEN_STORE ?? 'auto';
  if (!['auto', 'file', 'redis'].includes(mode)) throw new Error('REDPEN_STORE must be auto, file or redis.');
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? process.env.REDIS_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? process.env.REDIS_KV_REST_API_TOKEN;
  if (mode !== 'file' && url && token) {
    const key = process.env.REDPEN_REDIS_KEY ?? 'redpen:demo:v1';
    globalStores.__redpenRedisStores ??= new Map();
    const cacheKey = `${url}:${key}:${token}`;
    let store = globalStores.__redpenRedisStores.get(cacheKey);
    if (!store) { store = createRedisStore({ url, token, key }); globalStores.__redpenRedisStores.set(cacheKey, store); }
    return store;
  }
  if (mode === 'redis' || process.env.VERCEL === '1') throw new Error('Connect Upstash Redis and set its REST URL/token before running Redpen on Vercel.');
  return getFileStore();
}
export async function withStoreTransaction<T>(store: MemoryStore, work: (snapshot: MemoryStore) => Promise<T>): Promise<T> {
  return 'transaction' in store ? (store as TransactionalStore).transaction(work) : work(store);
}
/** One Redis snapshot per learner; local files use isolated namespaces in the same file. */
export function getPersonalStore(learnerId: string): MemoryStore {
  if (!/^[a-f0-9-]{36}$/.test(learnerId)) throw new Error('Invalid learner identity');
  const root = getStore();
  if ((root as TransactionalStore).backend !== 'redis') return learnerStore(root, learnerId);
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? process.env.REDIS_KV_REST_API_URL)!;
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? process.env.REDIS_KV_REST_API_TOKEN)!;
  const key = `${process.env.REDPEN_REDIS_KEY ?? 'redpen:demo:v1'}:learner:${learnerId}`;
  globalStores.__redpenRedisStores ??= new Map();
  const cacheKey = `${url}:${key}:${token}`;
  let store = globalStores.__redpenRedisStores.get(cacheKey);
  if (!store) { store = createRedisStore({ url, token, key }); globalStores.__redpenRedisStores.set(cacheKey, store); }
  return store;
}
