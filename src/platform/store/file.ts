import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Fact, MemoryStore, Namespace, NewFact } from '../types';
import { createMemoryStore, type MemoryStoreWithDump } from './memory';

const globalStores = globalThis as typeof globalThis & {
  __havkStores?: Map<string, MemoryStore>;
};

/**
 * JSON-file-backed store at `<app>/data/store.json`.
 * Swap to SQLite/Postgres later by reimplementing this factory only — the
 * MemoryStore interface is the contract every product code path depends on.
 */
export function createFileStore(filePath: string): MemoryStore & { backend: 'file'; transaction<T>(work: (snapshot: MemoryStore) => Promise<T>): Promise<T> } {
  let inner: MemoryStoreWithDump | null = null;
  let loading: Promise<MemoryStoreWithDump> | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  async function load(): Promise<MemoryStoreWithDump> {
    if (inner) return inner;
    if (!loading) loading = (async () => {
      let facts: Fact[] = [];
      try {
        const raw = JSON.parse(await readFile(filePath, 'utf8')) as { facts?: Fact[] };
        if (!Array.isArray(raw.facts)) throw new Error('Invalid local store; refusing to reset saved data.');
        facts = raw.facts;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      inner = createMemoryStore(facts); return inner;
    })();
    return loading;
  }
  async function transaction<T>(work: (snapshot: MemoryStore) => Promise<T>): Promise<T> {
    const operation = queue.then(async () => {
      const current = await load(); const before = current.dump();
      const snapshot = createMemoryStore(before); const result = await work(snapshot);
      const facts = snapshot.dump();
      if (JSON.stringify(before) !== JSON.stringify(facts)) {
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(`${filePath}.tmp`, JSON.stringify({ facts }, null, 2), 'utf8');
        await rename(`${filePath}.tmp`, filePath);
        inner = snapshot;
      }
      return result;
    });
    queue = operation.catch(() => undefined);
    return operation;
  }
  return {
    backend: 'file', transaction,
    put: fact => transaction(store => store.put(fact)),
    latest: async (ns, key) => (await load()).latest(ns, key),
    history: async (ns, key) => (await load()).history(ns, key),
    all: async (ns, opts) => (await load()).all(ns, opts),
    namespaces: async () => (await load()).namespaces(),
    reset: ns => transaction(store => store.reset(ns)),
  };
}

/**
 * Process-wide singleton, cached on globalThis so Next.js dev HMR does not
 * duplicate the store and drop writes between hot reloads.
 */
export function getStore(filePath = process.env.REDPEN_DATA_FILE ?? path.join(process.cwd(), 'data', 'store.json')): MemoryStore {
  const resolved = path.resolve(filePath);
  globalStores.__havkStores ??= new Map();
  const existing = globalStores.__havkStores.get(resolved);
  if (existing) return existing;
  const created = createFileStore(resolved);
  globalStores.__havkStores.set(resolved, created);
  return created;
}
