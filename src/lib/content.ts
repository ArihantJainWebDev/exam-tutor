/** Pure content contracts and validation; no IO or UI dependencies. */
export const CHAPTERS = ['elec', 'light', 'eye', 'magnet', 'energy'] as const;
export type Chapter = (typeof CHAPTERS)[number];
export interface Concept {
  id: string;
  label: string;
  chapter: Chapter;
  prereqs: string[];
  difficultyCeiling?: 1 | 2 | 3;
}
export interface Item {
  id: string;
  conceptIds: string[];
  difficulty: 1 | 2 | 3;
  kind: 'mcq' | 'short';
  stem: string;
  options?: string[];
  answer: string | number;
  reasoningPrompt: string;
  misconceptionTags: string[];
  explanation: string;
  markAllocation: 1 | 2 | 3 | 5;
}
export interface Misconception {
  id: string;
  label: string;
  conceptIds: string[];
  correctPrinciple: string;
  remediationHint: string;
}
export interface PhysicsContent {
  graph: Concept[];
  bank: Item[];
  misconceptions: Misconception[];
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(text) && new Set(v).size === v.length;

/** Reports all schema/reference errors. It never trusts a JSON type assertion. */
export function validateContent(input: unknown): string[] {
  if (!record(input)) return ['Content must be an object.'];
  const errors: string[] = [];
  for (const name of ['graph', 'bank', 'misconceptions']) {
    if (!Array.isArray(input[name])) errors.push(`${name} must be an array.`);
  }
  if (errors.length) return errors;
  const graph = input.graph as unknown[];
  const bank = input.bank as unknown[];
  const taxonomy = input.misconceptions as unknown[];
  const concepts = new Map<string, Concept>();
  const tags = new Map<string, Misconception>();
  function unique(rows: unknown[], name: string) {
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (!record(r) || !text(r.id)) errors.push(`${name}[${i}]: missing id.`);
      else if (seen.has(r.id)) errors.push(`${name}: duplicate id ${r.id}.`);
      else seen.add(r.id);
    });
  }
  unique(graph, 'graph'); unique(bank, 'bank'); unique(taxonomy, 'misconceptions');
  graph.forEach((r, i) => {
    if (!record(r) || !text(r.id) || !text(r.label) || !CHAPTERS.includes(r.chapter as Chapter)
      || !strings(r.prereqs) || !r.id.startsWith(`${r.chapter}:`)
      || (r.difficultyCeiling !== undefined && ![1, 2, 3].includes(r.difficultyCeiling as number))) {
      errors.push(`graph[${i}]: invalid concept schema.`); return;
    }
    concepts.set(r.id, r as unknown as Concept);
  });
  for (const c of concepts.values()) for (const p of c.prereqs) {
    if (!concepts.has(p)) errors.push(`${c.id}: unknown prerequisite ${p}.`);
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  function visit(id: string) {
    if (active.has(id)) { errors.push(`Prerequisite cycle at ${id}.`); return; }
    if (visited.has(id)) return;
    active.add(id);
    concepts.get(id)?.prereqs.forEach(visit);
    active.delete(id); visited.add(id);
  }
  concepts.forEach((_, id) => visit(id));
  taxonomy.forEach((r, i) => {
    if (!record(r) || !text(r.id) || !r.id.startsWith('m:') || !text(r.label)
      || !strings(r.conceptIds) || !r.conceptIds.length || !text(r.correctPrinciple) || !text(r.remediationHint)) {
      errors.push(`misconceptions[${i}]: invalid taxonomy schema.`); return;
    }
    for (const id of r.conceptIds) if (!concepts.has(id)) errors.push(`${r.id}: unknown concept ${id}.`);
    tags.set(r.id, r as unknown as Misconception);
  });
  const covered = new Set<string>(); const usedTags = new Set<string>();
  const bands = new Map<Chapter, Set<number>>(); let demoCount = 0;
  bank.forEach((r, i) => {
    if (!record(r) || !text(r.id) || !strings(r.conceptIds) || r.conceptIds.length < 1 || r.conceptIds.length > 2
      || ![1, 2, 3].includes(r.difficulty as number) || !['mcq', 'short'].includes(r.kind as string)
      || !text(r.stem) || !(text(r.answer) || (typeof r.answer === 'number' && Number.isFinite(r.answer)))
      || !text(r.reasoningPrompt) || !text(r.explanation) || !strings(r.misconceptionTags)
      || ![1, 2, 3, 5].includes(r.markAllocation as number)) {
      errors.push(`bank[${i}]: invalid item schema.`); return;
    }
    if (r.kind === 'mcq' && (!strings(r.options) || r.options.length < 2 || !r.options.includes(String(r.answer)))) {
      errors.push(`${r.id}: MCQ requires unique options containing its exact answer.`);
    }
    if (r.options !== undefined && !strings(r.options)) errors.push(`${r.id}: invalid options.`);
    for (const id of r.conceptIds) {
      const c = concepts.get(id);
      if (!c) { errors.push(`${r.id}: unknown concept ${id}.`); continue; }
      covered.add(id);
      if (c.difficultyCeiling && (r.difficulty as number) > c.difficultyCeiling) errors.push(`${r.id}: exceeds difficulty ceiling.`);
      const b = bands.get(c.chapter) ?? new Set<number>(); b.add(r.difficulty as number); bands.set(c.chapter, b);
    }
    if (r.conceptIds.some(id => ['elec', 'light'].includes(concepts.get(id)?.chapter ?? ''))) demoCount++;
    for (const tag of r.misconceptionTags) {
      const t = tags.get(tag);
      if (!t) errors.push(`${r.id}: unknown misconception ${tag}.`);
      else if (!t.conceptIds.some(id => (r.conceptIds as string[]).includes(id))) errors.push(`${r.id}: unrelated misconception ${tag}.`);
      usedTags.add(tag);
    }
  });
  if (graph.length !== 24) errors.push('Phase 1 requires 24 concepts.');
  if (bank.length < 40) errors.push('Phase 1 requires at least 40 questions.');
  if (taxonomy.length !== 12) errors.push('Phase 1 requires 12 misconception definitions.');
  concepts.forEach((_, id) => { if (!covered.has(id)) errors.push(`No question covers ${id}.`); });
  tags.forEach((_, id) => { if (!usedTags.has(id)) errors.push(`No question diagnoses ${id}.`); });
  for (const chapter of CHAPTERS) if (bands.get(chapter)?.size !== 3) errors.push(`${chapter}: needs all three difficulty bands.`);
  if (demoCount < 8) errors.push('Need at least eight electricity/light demo questions.');
  return errors;
}

export function parseContent(input: unknown): PhysicsContent {
  const errors = validateContent(input);
  if (errors.length) throw new Error(`Invalid physics content:\n${errors.join('\n')}`);
  return input as PhysicsContent;
}
