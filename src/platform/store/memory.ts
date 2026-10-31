import { randomUUID } from 'node:crypto';
import type { AllOptions, Fact, MemoryStore, Namespace, NewFact } from '../types';

export interface MemoryStoreWithDump extends MemoryStore {
  /** Snapshot of every fact, including superseded versions. Used by file persistence and tests. */
  dump(): Fact[];
}

/** Pure data structure: no I/O, no timers. Safe in tests. */
export function createMemoryStore(initial: Fact[] = []): MemoryStoreWithDump {
  const facts: Fact[] = [...initial];

  function versionsOf(namespace: Namespace, key: string): Fact[] {
    return facts
      .filter((f) => f.namespace === namespace && f.key === key)
      .sort((a, b) => a.version - b.version);
  }

  return {
    async put<T>(fact: NewFact<T>): Promise<Fact<T>> {
      const version = versionsOf(fact.namespace, fact.key).length + 1;
      const stored: Fact<T> = { ...fact, id: randomUUID(), version };
      facts.push(stored as Fact);
      return stored;
    },

    async latest<T>(namespace: Namespace, key: string): Promise<Fact<T> | null> {
      const versions = versionsOf(namespace, key);
      return (versions.at(-1) as Fact<T> | undefined) ?? null;
    },

    async history<T>(namespace: Namespace, key: string): Promise<Fact<T>[]> {
      return versionsOf(namespace, key) as Fact<T>[];
    },

    async all<T>(namespace: Namespace, opts: AllOptions = {}): Promise<Fact<T>[]> {
      const inScope = facts.filter(
        (f) => f.namespace === namespace && (!opts.before || f.at <= opts.before),
      );
      const latestByKey = new Map<string, Fact>();
      for (const fact of inScope) {
        const current = latestByKey.get(fact.key);
        if (!current || fact.version > current.version) latestByKey.set(fact.key, fact);
      }
      return [...latestByKey.values()].sort((a, b) => a.at.localeCompare(b.at)) as Fact<T>[];
    },

    async reset(namespace?: Namespace): Promise<void> {
      if (!namespace) {
        facts.length = 0;
        return;
      }
      for (let i = facts.length - 1; i >= 0; i -= 1) {
        if (facts[i].namespace === namespace) facts.splice(i, 1);
      }
    },

    async namespaces(): Promise<Namespace[]> {
      return [...new Set(facts.map((f) => f.namespace))].sort();
    },

    dump(): Fact[] {
      return [...facts];
    },
  };
}
