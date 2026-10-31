import { createMemoryStore } from './memory';
import type { MemoryStore, Fact } from '../types';

export interface TransactionalStore extends MemoryStore {
  backend?: 'file' | 'redis';
  transaction<T>(work: (snapshot: MemoryStore) => Promise<T>): Promise<T>;
}
export interface RedisOptions { url: string; token: string; key?: string; fetchImpl?: typeof fetch }
interface Snapshot { revision: number; facts: Fact[] }
// Whole-demo snapshot CAS: answer/mastery/SRS/session are committed together, including across Vercel instances.
export const COMMIT_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local revision = 0
if raw then revision = cjson.decode(raw).revision end
if revision ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;

export function createRedisStore(options: RedisOptions): TransactionalStore {
  const key = options.key ?? 'redpen:demo:v1';
  const url = options.url.replace(/\/$/, '');
  if (!url.startsWith('https://') || !options.token) throw new Error('Redis requires an HTTPS REST URL and token.');
  async function command(args: (string | number)[]) {
    const response = await (options.fetchImpl ?? fetch)(url, { method: 'POST', cache: 'no-store',
      headers: { authorization: `Bearer ${options.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Redis storage request failed (HTTP ${response.status}).`);
    const body = await response.json() as { result?: unknown; error?: string };
    if (body.error) throw new Error('Redis rejected the storage command. Check the service configuration.');
    return body.result;
  }
  async function load(): Promise<Snapshot> {
    const raw = await command(['GET', key]);
    if (raw === null) return { revision: 0, facts: [] };
    if (typeof raw !== 'string') throw new Error('Invalid Redis snapshot response.');
    const value = JSON.parse(raw) as Snapshot;
    if (!Number.isInteger(value.revision) || value.revision < 0 || !Array.isArray(value.facts)) throw new Error('Invalid Redis snapshot; refusing to overwrite it.');
    return value;
  }
  const read = async () => createMemoryStore((await load()).facts);
  const transaction: TransactionalStore['transaction'] = async work => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await load(); const snapshot = createMemoryStore(before.facts);
      const result = await work(snapshot); const facts = snapshot.dump();
      if (JSON.stringify(facts) === JSON.stringify(before.facts)) return result;
      const after = JSON.stringify({ revision: before.revision + 1, facts });
      if (await command(['EVAL', COMMIT_SCRIPT, 1, key, before.revision, after]) === 1) return result;
    }
    throw new Error('Progress changed concurrently. Reload and retry this step.');
  };
  return {
    backend: 'redis',
    transaction,
    put: fact => transaction(store => store.put(fact)),
    latest: async (ns, key) => (await read()).latest(ns, key),
    history: async (ns, key) => (await read()).history(ns, key),
    all: async (ns, opts) => (await read()).all(ns, opts),
    namespaces: async () => (await read()).namespaces(),
    reset: ns => transaction(store => store.reset(ns)),
  };
}
