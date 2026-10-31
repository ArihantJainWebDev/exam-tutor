export const THETA_MIN = -3, THETA_MAX = 3, ALPHA = 0.35, K = 1;
export interface State {
  logit: number;
  mastery: number;
  confidence: number;
  lastAt: string | null;
  attempts: number;
  correctStreak: number;
  misconceptionStrength: Record<string, number>;
}
export interface Evidence {
  correct: boolean;
  difficulty: 1 | 2 | 3;
  at: string;
  conceptCount?: number;
  diagnostic?: boolean;
  misconception?: { tag: string; confidence: number };
}
export const clamp = (n: number, min = THETA_MIN, max = THETA_MAX) => Math.max(min, Math.min(max, n));
export const pCorrect = (theta: number, difficulty: number) => 1 / (1 + Math.exp(-(theta - (difficulty - 2))));
export const initialState = (): State => ({ logit: 0, mastery: 0.5, confidence: 0, lastAt: null, attempts: 0, correctStreak: 0, misconceptionStrength: {} });
export function updateMastery(prev: State, ev: Evidence): State {
  const count = ev.conceptCount ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 2) throw new Error('Expected one or two concepts.');
  const rate = ALPHA * (ev.diagnostic ? 1.4 : 1) / count;
  let logit = clamp(prev.logit + rate * ((ev.correct ? 1 : 0) - pCorrect(prev.logit, ev.difficulty)));
  const tag = ev.misconception && ev.misconception.confidence >= 0.55 ? ev.misconception.tag : null;
  if (tag) logit = clamp(logit - 0.2 * ev.misconception!.confidence);
  return { logit, mastery: 1 / (1 + Math.exp(-logit)), confidence: Math.min(1, (prev.attempts + 1) / 5),
    lastAt: ev.at, attempts: prev.attempts + 1, correctStreak: ev.correct ? prev.correctStreak + 1 : 0,
    misconceptionStrength: { ...prev.misconceptionStrength,
      ...(tag ? { [tag]: (prev.misconceptionStrength[tag] ?? 0) + 1 } : {}) } };
}
