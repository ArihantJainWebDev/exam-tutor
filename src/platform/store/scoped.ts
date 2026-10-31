import type { Fact, MemoryStore, NewFact } from '../types';
import type { TransactionalStore } from './redis';
/** Identity must come from a verified server cookie, never a caller-supplied learner id. */
export function learnerStore(store: MemoryStore, learnerId: string): MemoryStore {
  if (!/^[a-f0-9-]{36}$/.test(learnerId)) throw new Error('Invalid learner identity');
  const prefix = `learner.${learnerId}.`;
  const unwrap = <T>(f: Fact<T>): Fact<T> => ({ ...f, namespace: f.namespace.slice(prefix.length) });
  const scoped: MemoryStore = {
    async put<T>(fact: NewFact<T>) { return unwrap(await store.put({ ...fact, namespace: prefix + fact.namespace })); },
    async latest<T>(ns: string, key: string) { const fact = await store.latest<T>(prefix + ns, key); return fact ? unwrap(fact) : null; },
    async history<T>(ns: string, key: string) { return (await store.history<T>(prefix + ns, key)).map(unwrap); },
    async all<T>(ns: string, opts = {}) { return (await store.all<T>(prefix + ns, opts)).map(unwrap); },
    async namespaces() { return (await store.namespaces()).filter(ns => ns.startsWith(prefix)).map(ns => ns.slice(prefix.length)); },
    async reset(ns?: string) {
      if (ns) return store.reset(prefix + ns);
      for (const name of await store.namespaces()) if (name.startsWith(prefix)) await store.reset(name);
    },
  };
  if ('transaction' in store) Object.assign(scoped, { transaction: <T>(work: (snapshot: MemoryStore) => Promise<T>) =>
    (store as TransactionalStore).transaction(snapshot => work(learnerStore(snapshot, learnerId))) });
  return scoped;
}
