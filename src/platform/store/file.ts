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
export function createFileStore(filePath: string): MemoryStore {
  let inner: MemoryStoreWithDump | null = null;
  let loading: Promise<MemoryStoreWithDump> | null = null;
  let writeQueue: Promise<void> = Promise.resolve();

  async function load(): Promise<MemoryStoreWithDump> {
    if (inner) return inner;
    if (loading) return loading;
    loading = (async () => {
      let seed: Fact[] = [];
      try {
        const raw = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw) as { facts?: Fact[] };
        seed = Array.isArray(parsed.facts) ? parsed.facts : [];
      } catch {
        seed = []; // missing or unreadable file means an empty store, never a crash on first run
      }
      inner = createMemoryStore(seed);
      return inner;
    })();
    return loading;
  }

  function persist(): void {
    const snapshot = inner?.dump() ?? [];
    writeQueue = writeQueue.then(async () => {
      await mkdir(path.dirname(filePath), { recursive: true });
      const tmp = `${filePath}.tmp`;
      await writeFile(tmp, JSON.stringify({ facts: snapshot }, null, 2), 'utf8');
      await rename(tmp, filePath);
    });
    // Persistence failures must not take the demo down; surface them loudly instead.
    writeQueue.catch((error) => console.error('[platform/store] persist failed:', error));
  }

  return {
    async put<T>(fact: NewFact<T>): Promise<Fact<T>> {
      const store = await load();
      const stored = await store.put(fact);
      persist();
      return stored;
    },
    async latest<T>(namespace: Namespace, key: string) {
      return (await load()).latest<T>(namespace, key);
    },
    async history<T>(namespace: Namespace, key: string) {
      return (await load()).history<T>(namespace, key);
    },
    async all<T>(namespace: Namespace, opts = {}) {
      return (await load()).all<T>(namespace, opts);
    },
    async reset(namespace?: Namespace) {
      const store = await load();
      await store.reset(namespace);
      persist();
    },
    async namespaces() {
      return (await load()).namespaces();
    },
  };
}

/**
 * Process-wide singleton, cached on globalThis so Next.js dev HMR does not
 * duplicate the store and drop writes between hot reloads.
 */
export function getStore(filePath = path.join(process.cwd(), 'data', 'store.json')): MemoryStore {
  const resolved = path.resolve(filePath);
  globalStores.__havkStores ??= new Map();
  const existing = globalStores.__havkStores.get(resolved);
  if (existing) return existing;
  const created = createFileStore(resolved);
  globalStores.__havkStores.set(resolved, created);
  return created;
}
