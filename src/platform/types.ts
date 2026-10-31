/**
 * The shared spine of this product (D-005): a versioned fact store.
 * In this repo it is the learner model — mastery per concept, one version per
 * answer, with provenance. The same shape is the cross-meeting memory in the
 * meetings repo. The two repos are independent copies — see D-012.
 * See ARCHITECTURE.md §3 for the mastery model built on top of it.
 */

export type Namespace =
  | 'tutor.mastery'
  | 'tutor.misconception'
  | 'tutor.attempt'
  | (string & {}); // product-specific extensions, e.g. 'tutor.cohort.<id>'

export interface Fact<T = unknown> {
  id: string;
  namespace: Namespace;
  /** Join column: conceptId · attemptId. */
  key: string;
  value: T;
  /** Monotonic per (namespace, key). Starts at 1. */
  version: number;
  /** ISO time the fact was *true* — the answer time, never write time. */
  at: string;
  /** Provenance: attemptId / diagnostic session id. Surfaced as the provenance footer. */
  sourceId: string;
}

export type NewFact<T = unknown> = Omit<Fact<T>, 'id' | 'version'>;

export interface AllOptions {
  /** When set, returns the latest version of each key whose `at` is <= this ISO time. */
  before?: string;
}

export interface MemoryStore {
  put<T>(fact: NewFact<T>): Promise<Fact<T>>;
  latest<T>(namespace: Namespace, key: string): Promise<Fact<T> | null>;
  /** Every version of one key, oldest first. */
  history<T>(namespace: Namespace, key: string): Promise<Fact<T>[]>;
  /** Latest version per key in a namespace, sorted by `at` ascending. */
  all<T>(namespace: Namespace, opts?: AllOptions): Promise<Fact<T>[]>;
  /** Clears one namespace, or the whole store when omitted. Used by the seed script. */
  reset(namespace?: Namespace): Promise<void>;
  namespaces(): Promise<Namespace[]>;
}
