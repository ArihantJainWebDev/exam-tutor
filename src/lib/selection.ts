import type { Concept, Item } from './content';
import type { State } from './mastery';
export interface SelectionOptions {
  now: string;
  recentIds: string[];
  dueConceptIds?: string[];
}
export function rankQuestions(state: Record<string, State>, bank: Item[], graph: Concept[], opts: SelectionOptions) {
  return bank.filter(i => !opts.recentIds.includes(i.id)).map(item => {
    const conceptId = [...item.conceptIds].sort((a, b) => (state[a]?.mastery ?? 0.3) - (state[b]?.mastery ?? 0.3))[0];
    const mastery = state[conceptId]?.mastery ?? 0.3;
    const band = mastery < 0.35 ? 1 : mastery <= 0.65 ? 2 : 3;
    const readiness = item.conceptIds.every(id => graph.find(c => c.id === id)?.prereqs.every(p => (state[p]?.mastery ?? 0) >= 0.5)) ? 1 : 0;
    const due = item.conceptIds.some(id => opts.dueConceptIds?.includes(id)) ? 0.3 : 0;
    const tagBonus = item.misconceptionTags.some(tag => item.conceptIds.some(id => (state[id]?.misconceptionStrength[tag] ?? 0) > 0)) ? 0.25 : 0;
    return { item, conceptId, mastery, hasEvidence: (state[conceptId]?.attempts ?? 0) > 0, readiness: Boolean(readiness),
      score: 1.6 * (1 - mastery) + (1 - Math.abs(item.difficulty - band) / 2) + 0.8 * readiness + due * 0.6 + tagBonus };
  }).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
}
export function nextQuestion(state: Record<string, State>, bank: Item[], graph: Concept[], opts: SelectionOptions) {
  return rankQuestions(state, bank, graph, opts)[0];
}
/** Keep the last five distinct items out; if exhausted, retain only immediate exclusion. */
export function selectPractice(state: Record<string, State>, bank: Item[], graph: Concept[], opts: SelectionOptions) {
  return nextQuestion(state, bank, graph, opts) ?? nextQuestion(state, bank, graph, { ...opts, recentIds: opts.recentIds.slice(-1) });
}
