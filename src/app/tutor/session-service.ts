import { randomUUID } from 'node:crypto';
import type { MemoryStore } from '@/platform/types';
import type { PhysicsContent } from '@/lib/content';
import { initialState, updateMastery, type State } from '@/lib/mastery';
import { diagnosticItems } from '@/lib/diagnostic';
import { selectPractice } from '@/lib/selection';
import { classifyReasoning, type Classifier } from './classifier';
import { detectedMisconception, type ReasoningAnalysis } from '@/lib/misconception';
import { scheduleReview, dueReviews, type ReviewState } from '@/lib/srs';

interface Feedback {
  token: string; correct: boolean; answer: string | number; selectedAnswer: string; explanation: string; reasoning: string;
  changes: { conceptId: string; before: number; after: number }[];
  analysis?: ReasoningAnalysis;
  reviews?: { conceptId: string; dueAt: string; box: number; remediation: boolean }[];
}
interface Session {
  id: string; mode: 'diagnostic' | 'practice'; diagnosticIndex: number; answered: number;
  itemId: string; token: string; recentIds: string[]; feedback: Feedback | null;
}
export interface SessionView {
  sessionId: string | null;
  mode: 'diagnostic' | 'practice' | 'welcome'; answered: number; diagnosticIndex: number;
  token: string | null;
  question: { id: string; stem: string; options: string[]; reasoningPrompt: string; difficulty: number; marks: number; conceptIds: string[] } | null;
  selection: { conceptId: string; mastery: number | null; readiness: boolean } | null;
  mastery: { conceptId: string; label: string; mastery: number | null; confidence: number; attempts: number }[];
  feedback: Feedback | null;
  reviews: { conceptId: string; label: string; dueAt: string; box: number; remediation: boolean; due: boolean }[];
}
export class SessionError extends Error {}

/** One demo learner. All writes use the app's MemoryStore contract. Caller serialises mutations. */
export function createSessionService(store: MemoryStore, content: PhysicsContent, options: { classify?: Classifier; now?: () => string } = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const classify = options.classify ?? classifyReasoning;
  const sessionKey = 'demo';
  async function readSession() { return (await store.latest<Session>('tutor.session', sessionKey))?.value ?? null; }
  async function states() {
    return Object.fromEntries((await store.all<State>('tutor.mastery')).map(f => [f.key, f.value]));
  }
  async function reviews() {
    return Object.fromEntries((await store.all<ReviewState>('tutor.srs')).map(f => [f.key, f.value]));
  }
  async function selectionOptions(recentIds: string[]) {
    const queue = await reviews();
    return { now: now(), recentIds, dueConceptIds: dueReviews(queue, now()).map(([id]) => id),
      remediationConceptIds: Object.entries(queue).filter(([, r]) => r.remediation).map(([id]) => id) };
  }
  async function save(session: Session) {
    await store.put({ namespace: 'tutor.session', key: sessionKey, value: session, at: now(), sourceId: session.id });
  }
  async function view(): Promise<SessionView> {
    const session = await readSession(); const state = await states(); const queue = await reviews();
    const item = content.bank.find(i => i.id === session?.itemId);
    const conceptId = item ? [...item.conceptIds].sort((a, b) => (state[a]?.mastery ?? 0.3) - (state[b]?.mastery ?? 0.3))[0] : null;
    return { sessionId: session?.id ?? null, mode: session?.mode ?? 'welcome', answered: session?.answered ?? 0,
      diagnosticIndex: session?.diagnosticIndex ?? 0, token: session?.token ?? null,
      question: item ? { id: item.id, stem: item.stem, options: item.options ?? [], reasoningPrompt: item.reasoningPrompt,
        difficulty: item.difficulty, marks: item.markAllocation, conceptIds: item.conceptIds } : null,
      selection: conceptId && item ? { conceptId, mastery: state[conceptId]?.mastery ?? null,
        readiness: item.conceptIds.every(id => content.graph.find(c => c.id === id)?.prereqs.every(p => (state[p]?.mastery ?? 0) >= 0.5)) } : null,
      mastery: content.graph.map(c => ({ conceptId: c.id, label: c.label, mastery: state[c.id]?.mastery ?? null,
        confidence: state[c.id]?.confidence ?? 0, attempts: state[c.id]?.attempts ?? 0 })), feedback: session?.feedback ?? null,
      reviews: Object.entries(queue).sort((a, b) => a[1].dueAt.localeCompare(b[1].dueAt)).map(([id, r]) => ({ conceptId: id,
        label: content.graph.find(c => c.id === id)?.label ?? id, dueAt: r.dueAt, box: r.box, remediation: r.remediation, due: Date.parse(r.dueAt) <= Date.parse(now()) })) };
  }
  async function start(mode: unknown) {
    if (mode !== 'diagnostic' && mode !== 'practice') throw new SessionError('Choose diagnostic or practice.');
    if (await readSession()) return view(); // Refreshes/repeated clicks resume, never reset evidence.
    const item = mode === 'diagnostic' ? diagnosticItems(content.bank)[0] : selectPractice(await states(), content.bank, content.graph, await selectionOptions([]))?.item;
    if (!item) throw new SessionError('No questions are available.');
    await save({ id: randomUUID(), mode, diagnosticIndex: 0, answered: 0, itemId: item.id, token: randomUUID(), recentIds: [], feedback: null });
    return view();
  }
  async function answer(input: { token: unknown; answer: unknown; reasoning: unknown }) {
    const session = await readSession();
    if (!session || input.token !== session.token) throw new SessionError('This question has changed. Reload to resume.');
    if (session.feedback) return view(); // Same submission retry never adds evidence twice.
    const item = content.bank.find(i => i.id === session.itemId)!;
    if (typeof input.answer !== 'string' || !item.options?.includes(input.answer)) throw new SessionError('Choose one of the listed answers.');
    if (typeof input.reasoning !== 'string' || !input.reasoning.trim() || input.reasoning.length > 4000) throw new SessionError('Explain your reasoning in 1–4000 characters.');
    const state = await states(); const at = now(); const attemptId = `${session.id}:${session.answered + 1}`;
    const correct = String(item.answer) === input.answer;
    const analysis = await classify({ item, answer: input.answer, reasoning: input.reasoning.trim(), correct }, content.misconceptions);
    const tag = detectedMisconception(analysis) ? content.misconceptions.find(t => t.id === analysis.tag) : undefined;
    const queue = await reviews(); const updatedReviews = [];
    const changes = [];
    for (const conceptId of item.conceptIds) {
      const prev = state[conceptId] ?? initialState();
      const misconception = !correct && tag?.conceptIds.includes(conceptId) ? { tag: tag.id, confidence: analysis.confidence } : undefined;
      const next = updateMastery(prev, { correct, difficulty: item.difficulty, at, conceptCount: item.conceptIds.length, diagnostic: session.mode === 'diagnostic', misconception });
      await store.put({ namespace: 'tutor.mastery', key: conceptId, value: next, at, sourceId: attemptId });
      const review = scheduleReview(queue[conceptId], { at, correct, mastery: next.mastery, misconception: Boolean(misconception) });
      await store.put({ namespace: 'tutor.srs', key: conceptId, value: review, at, sourceId: attemptId });
      updatedReviews.push({ conceptId, dueAt: review.dueAt, box: review.box, remediation: review.remediation });
      changes.push({ conceptId, before: prev.mastery, after: next.mastery });
    }
    if (!correct && tag) await store.put({ namespace: 'tutor.misconception', key: attemptId, at, sourceId: attemptId,
      value: { ...analysis, itemId: item.id, conceptIds: item.conceptIds.filter(id => tag.conceptIds.includes(id)) } });
    await store.put({ namespace: 'tutor.attempt', key: attemptId, at, sourceId: attemptId,
      value: { itemId: item.id, conceptIds: item.conceptIds, answer: input.answer, reasoning: input.reasoning.trim(), correct, mode: session.mode, analysis } });
    await save({ ...session, answered: session.answered + 1,
      recentIds: [...session.recentIds, item.id].slice(-5),
      feedback: { token: session.token, correct, answer: item.answer, selectedAnswer: input.answer, explanation: item.explanation, reasoning: input.reasoning.trim(), changes, analysis, reviews: updatedReviews } });
    return view();
  }
  async function advance(token: unknown) {
    const session = await readSession();
    if (!session || token !== session.token || !session.feedback) throw new SessionError('Submit this question before continuing.');
    const index = session.diagnosticIndex + 1;
    const diagnostics = diagnosticItems(content.bank);
    const stillDiagnostic = session.mode === 'diagnostic' && index < diagnostics.length;
    const item = stillDiagnostic ? diagnostics[index] : selectPractice(await states(), content.bank, content.graph,
      await selectionOptions(session.recentIds))?.item;
    if (!item) throw new SessionError('No other questions are available.');
    await save({ ...session, mode: stillDiagnostic ? 'diagnostic' : 'practice', diagnosticIndex: session.mode === 'diagnostic' ? index : session.diagnosticIndex,
      itemId: item.id, token: randomUUID(), feedback: null });
    return view();
  }
  return { view, start, answer, advance };
}
