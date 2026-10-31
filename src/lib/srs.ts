export const REVIEW_INTERVALS = [1, 3, 7, 21, 60] as const;
const DAY = 24 * 60 * 60 * 1000;
export interface ReviewState {
  box: number;
  dueAt: string;
  lastAt: string;
  remediation: boolean;
}
export function scheduleReview(prev: ReviewState | undefined, ev: { at: string; correct: boolean; mastery: number; misconception: boolean }): ReviewState {
  if (!Number.isFinite(Date.parse(ev.at))) throw new Error('Invalid review timestamp');
  const old = prev?.box ?? 0;
  const box = ev.misconception ? 0 : !ev.correct ? Math.max(0, old - 2) : ev.mastery > 0.6 ? Math.min(4, old + 1) : old;
  return { box, lastAt: ev.at, dueAt: new Date(Date.parse(ev.at) + REVIEW_INTERVALS[box] * DAY).toISOString(),
    remediation: ev.misconception || (!ev.correct && Boolean(prev?.remediation)) };
}
export function dueReviews(reviews: Record<string, ReviewState>, now: string) {
  return Object.entries(reviews).filter(([, r]) => Date.parse(r.dueAt) <= Date.parse(now))
    .sort((a, b) => Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt) || a[0].localeCompare(b[0]));
}
