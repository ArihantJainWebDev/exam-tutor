import type { PhysicsContent } from './content';
import { initialState, pCorrect, updateMastery, type State } from './mastery';

export const COHORT_SEED = 20261031;
export const COHORT_VERSION = 1;
export interface SimulatedAttempt {
  id: string; itemId: string; conceptIds: string[]; correct: boolean; at: string;
  misconception?: { tag: string; confidence: number };
}
export interface SimulatedLearner {
  id: string; label: string; archetype: 'strong' | 'mid' | 'shaky';
  trueLogits: Record<string, number>; states: Record<string, State>; attempts: SimulatedAttempt[];
}
function random(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}
/** Synthetic evidence, not real students or LLM-classified explanations. Pure and repeatable. */
export function simulateClass(content: PhysicsContent, n = 20, seed = COHORT_SEED): SimulatedLearner[] {
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('Expected 1–100 simulated learners.');
  const rng = random(seed);
  const focus = ['elec:series-circuits', 'light:reflection', 'eye:vision-defects', 'magnet:domestic-safety'];
  return Array.from({ length: n }, (_, index) => {
    const archetype = (['strong', 'mid', 'shaky'] as const)[index % 3];
    const baseline = { strong: 1.8, mid: 0, shaky: -2.1 }[archetype];
    const learner: SimulatedLearner = { id: `learner-${String(index + 1).padStart(2, '0')}`, label: `Learner ${String(index + 1).padStart(2, '0')}`,
      archetype, trueLogits: {}, states: {}, attempts: [] };
    for (const concept of content.graph) {
      learner.trueLogits[concept.id] = baseline + (rng() - 0.5) * 0.9 + (concept.chapter === 'elec' ? -0.35 : 0);
    }
    for (let step = 0; step < 40; step++) {
      // Cover the graph, then collect repeated evidence on four focus concepts.
      const target = step < content.graph.length ? content.graph[step].id : focus[(step - content.graph.length) % focus.length];
      const choices = content.bank.filter(i => i.conceptIds.includes(target));
      if (!choices.length) throw new Error(`No cohort question for ${target}.`);
      const item = choices[Math.floor(rng() * choices.length)];
      const theta = item.conceptIds.reduce((sum, id) => sum + learner.trueLogits[id], 0) / item.conceptIds.length;
      const correct = rng() < pCorrect(theta, item.difficulty);
      const candidateTags = content.misconceptions.filter(t => item.misconceptionTags.includes(t.id));
      const tag = !correct && candidateTags.length && rng() < 0.55 ? candidateTags[Math.floor(rng() * candidateTags.length)] : undefined;
      const misconception = tag ? { tag: tag.id, confidence: 0.85 } : undefined;
      const at = new Date(Date.UTC(2026, 9, 30, 9) + step * 60000).toISOString();
      learner.attempts.push({ id: `${learner.id}:attempt-${step + 1}`, itemId: item.id, conceptIds: item.conceptIds, correct, at,
        ...(misconception ? { misconception } : {}) });
      for (const id of item.conceptIds) learner.states[id] = updateMastery(learner.states[id] ?? initialState(), {
        correct, difficulty: item.difficulty, at, conceptCount: item.conceptIds.length,
        misconception: tag?.conceptIds.includes(id) ? misconception : undefined,
      });
    }
    return learner;
  });
}

export function summarizeClass(learners: Pick<SimulatedLearner, 'id' | 'label' | 'states' | 'attempts'>[], content: PhysicsContent) {
  const gaps = content.graph.map(concept => {
    const states = learners.map(l => l.states[concept.id]).filter((s): s is State => Boolean(s?.attempts));
    return { conceptId: concept.id, label: concept.label, observed: states.length,
      mean: states.length ? states.reduce((sum, s) => sum + s.mastery, 0) / states.length : null,
      lowEvidence: states.filter(s => s.confidence <= 0.6).length };
  }).sort((a, b) => (a.mean ?? 1) - (b.mean ?? 1) || a.conceptId.localeCompare(b.conceptId));
  const counts = new Map<string, number>();
  for (const l of learners) for (const a of l.attempts) if (a.misconception) counts.set(a.misconception.tag, (counts.get(a.misconception.tag) ?? 0) + 1);
  const misconceptions = [...counts].map(([id, count]) => ({ id, label: content.misconceptions.find(t => t.id === id)?.label ?? id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const atRisk = learners.map(l => ({ id: l.id, label: l.label,
    concepts: content.graph.filter(c => l.states[c.id]?.mastery < 0.35 && l.states[c.id]?.confidence > 0.6).map(c => ({ id: c.id, label: c.label })) }))
    .filter(l => l.concepts.length > 0).sort((a, b) => b.concepts.length - a.concepts.length || a.id.localeCompare(b.id));
  const values = Object.fromEntries(content.graph.map(c => [c.id, Object.fromEntries(learners.map(l => [l.id, l.states[c.id]?.attempts ? l.states[c.id].mastery : undefined]))]));
  return { gaps, misconceptions, atRisk, values,
    totalAnswers: learners.reduce((sum, l) => sum + l.attempts.length, 0),
    correctAnswers: learners.reduce((sum, l) => sum + l.attempts.filter(a => a.correct).length, 0) };
}
