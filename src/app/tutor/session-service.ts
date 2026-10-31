import { randomUUID } from 'node:crypto';
import type { MemoryStore } from '@/platform/types';
import type { PhysicsContent } from '@/lib/content';
import { initialState, updateMastery, type State } from '@/lib/mastery';
import { diagnosticItems } from '@/lib/diagnostic';
import { selectPractice } from '@/lib/selection';
import { classifyReasoning, type Classifier } from './classifier';
import { detectedMisconception, type ReasoningAnalysis } from '@/lib/misconception';
import { scheduleReview, dueReviews, type ReviewState } from '@/lib/srs';
import type { Item } from '@/lib/content';
import type { GeneratedQuestion } from '@/lib/generated-question';
import { teachingDecision, type TeachingDecision, type LearningEvidence } from '@/lib/teaching';
import { generateFollowUp, type QuestionGenerator } from './generator';

interface Feedback {
  token: string; correct: boolean; answer: string | number; selectedAnswer: string; explanation: string; reasoning: string;
  changes: { conceptId: string; before: number; after: number }[];
  analysis?: ReasoningAnalysis;
  reviews?: { conceptId: string; dueAt: string; box: number; remediation: boolean }[];
  decision?: TeachingDecision;
}
interface Session {
  id: string; mode: 'diagnostic' | 'practice'; diagnosticIndex: number; answered: number;
  itemId: string; token: string; recentIds: string[]; feedback: Feedback | null;
  purpose?: 'diagnostic' | 'practice' | 'verification';
  selectionReason?: string;
  notice?: string;
}
export interface SessionView {
  sessionId: string | null;
  mode: 'diagnostic' | 'practice' | 'welcome'; answered: number; diagnosticIndex: number;
  token: string | null;
  question: { id: string; stem: string; options: string[]; reasoningPrompt: string; difficulty: number; marks: number; conceptIds: string[] } | null;
  selection: { conceptId: string; mastery: number | null; readiness: boolean } | null;
  mastery: { conceptId: string; label: string; mastery: number | null; confidence: number; attempts: number }[];
  feedback: Feedback | null;
  purpose?: string;
  selectionReason?: string;
  questionSource?: 'live-generated' | 'reviewed-bank';
  notice?: string;
  learning: { conceptId: string; status: string; successfulChecks: number }[];
  reviews: { conceptId: string; label: string; dueAt: string; box: number; remediation: boolean; due: boolean }[];
}
export class SessionError extends Error {}

/** One demo learner. All writes use the app's MemoryStore contract. Caller serialises mutations. */
export function createSessionService(store: MemoryStore, content: PhysicsContent, options: { classify?: Classifier; now?: () => string; generate?: QuestionGenerator } = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const classify = options.classify ?? classifyReasoning;
  const generate = options.generate ?? generateFollowUp;
  const sessionKey = 'demo';
  async function readSession() { return (await store.latest<Session>('tutor.session', sessionKey))?.value ?? null; }
  async function states() {
    return Object.fromEntries((await store.all<State>('tutor.mastery')).map(f => [f.key, f.value]));
  }
  async function resolveItem(id?: string): Promise<Item | undefined> {
    if (!id) return undefined;
    return content.bank.find(i => i.id === id) ?? (await store.latest<Item>('tutor.generated', id))?.value;
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
    const item = await resolveItem(session?.itemId);
    const conceptId = item ? [...item.conceptIds].sort((a, b) => (state[a]?.mastery ?? 0.3) - (state[b]?.mastery ?? 0.3))[0] : null;
    return { sessionId: session?.id ?? null, mode: session?.mode ?? 'welcome', answered: session?.answered ?? 0,
      diagnosticIndex: session?.diagnosticIndex ?? 0, token: session?.token ?? null,
      purpose: session?.purpose, selectionReason: session?.selectionReason,
      questionSource: item?.id.startsWith('generated:') ? 'live-generated' : 'reviewed-bank', notice: session?.notice,
      learning: (await store.all<LearningEvidence>('tutor.learning')).map(f => ({ conceptId: f.key, status: f.value.status, successfulChecks: f.value.successfulChecks })),
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
    await save({ id: randomUUID(), mode, diagnosticIndex: 0, answered: 0, itemId: item.id, token: randomUUID(), recentIds: [], feedback: null,
      purpose: mode, selectionReason: mode === 'diagnostic' ? 'Initial syllabus evidence from a reviewed diagnostic question.' : 'Initial practice selected from weaker or unobserved concepts.' });
    return view();
  }
  async function answer(input: { token: unknown; answer: unknown; reasoning: unknown }) {
    const session = await readSession();
    if (!session || input.token !== session.token) throw new SessionError('This question has changed. Reload to resume.');
    if (session.feedback) return view(); // Same submission retry never adds evidence twice.
    const item = (await resolveItem(session.itemId))!;
    if (typeof input.answer !== 'string' || !item.options?.includes(input.answer)) throw new SessionError('Choose one of the listed answers.');
    if (typeof input.reasoning !== 'string' || !input.reasoning.trim() || input.reasoning.length > 4000) throw new SessionError('Explain your reasoning in 1–4000 characters.');
    const state = await states(); const at = now(); const attemptId = `${session.id}:${session.answered + 1}`;
    const correct = String(item.answer) === input.answer;
    const analysis = await classify({ item, answer: input.answer, reasoning: input.reasoning.trim(), correct }, content.misconceptions);
    const tag = detectedMisconception(analysis) ? content.misconceptions.find(t => t.id === analysis.tag) : undefined;
    const target = tag?.conceptIds.find(id => item.conceptIds.includes(id)) ?? [...item.conceptIds].sort((a, b) => (state[a]?.mastery ?? 0.3) - (state[b]?.mastery ?? 0.3))[0];
    const previousLearning = (await store.latest<LearningEvidence>('tutor.learning', target))?.value;
    let decision = teachingDecision({ analysis, correct, conceptId: target, pending: previousLearning });
    if (tag) await store.put({ namespace: 'tutor.learning', key: target, at, sourceId: attemptId,
      value: { status: 'verification-needed', tag: tag.id, lastAttemptId: attemptId, successfulChecks: 0 } satisfies LearningEvidence });
    else if (session.purpose === 'verification' && previousLearning && analysis.source === 'live' && analysis.reasoningKind === 'sound' && (analysis.reasoningConfidence ?? analysis.confidence) >= 0.55 && correct) {
      const checks = previousLearning.successfulChecks + 1;
      const evidence: LearningEvidence = { ...previousLearning, successfulChecks: checks, lastAttemptId: attemptId, status: checks >= 2 ? 'improvement-observed' : 'verification-needed' };
      await store.put({ namespace: 'tutor.learning', key: target, value: evidence, at, sourceId: attemptId });
      if (checks >= 2) decision = { ...decision, action: 'advance', reason: 'Two different follow-ups have correct answers and coherent reasoning. Improvement is observed; spaced review will check retention.' };
    }
    else if (previousLearning?.status === 'verification-needed' && !correct) await store.put({ namespace: 'tutor.learning', key: target,
      value: { ...previousLearning, successfulChecks: 0, lastAttemptId: attemptId }, at, sourceId: attemptId });
    const queue = await reviews(); const updatedReviews = [];
    const changes = [];
    for (const conceptId of item.conceptIds) {
      const prev = state[conceptId] ?? initialState();
      const misconception = tag?.conceptIds.includes(conceptId) ? { tag: tag.id, confidence: analysis.confidence } : undefined;
      const demonstratedCorrect = correct && !misconception;
      const next = updateMastery(prev, { correct: demonstratedCorrect, difficulty: item.difficulty, at, conceptCount: item.conceptIds.length, diagnostic: session.mode === 'diagnostic', misconception });
      await store.put({ namespace: 'tutor.mastery', key: conceptId, value: next, at, sourceId: attemptId });
      const review = scheduleReview(queue[conceptId], { at, correct: demonstratedCorrect, mastery: next.mastery, misconception: Boolean(misconception) });
      await store.put({ namespace: 'tutor.srs', key: conceptId, value: review, at, sourceId: attemptId });
      updatedReviews.push({ conceptId, dueAt: review.dueAt, box: review.box, remediation: review.remediation });
      changes.push({ conceptId, before: prev.mastery, after: next.mastery });
    }
    if (tag) await store.put({ namespace: 'tutor.misconception', key: attemptId, at, sourceId: attemptId,
      value: { ...analysis, itemId: item.id, conceptIds: item.conceptIds.filter(id => tag.conceptIds.includes(id)) } });
    await store.put({ namespace: 'tutor.attempt', key: attemptId, at, sourceId: attemptId,
      value: { itemId: item.id, conceptIds: item.conceptIds, answer: input.answer, reasoning: input.reasoning.trim(), correct, mode: session.mode, analysis, decision, questionSource: item.id.startsWith('generated:') ? 'live-generated' : 'reviewed-bank' } });
    await save({ ...session, answered: session.answered + 1,
      recentIds: [...session.recentIds, item.id].slice(-5),
      feedback: { token: session.token, correct, answer: item.answer, selectedAnswer: input.answer, explanation: item.explanation, reasoning: input.reasoning.trim(), changes, analysis, reviews: updatedReviews, decision } });
    return view();
  }
  async function advance(token: unknown) {
    const session = await readSession();
    if (!session || token !== session.token || !session.feedback) throw new SessionError('Submit this question before continuing.');
    const index = session.diagnosticIndex + (session.mode === 'diagnostic' && session.purpose !== 'verification' ? 1 : 0);
    const diagnostics = diagnosticItems(content.bank);
    const stillDiagnostic = session.mode === 'diagnostic' && index < diagnostics.length;
    const decision: TeachingDecision = session.feedback.decision ?? { action: 'advance', conceptId: '', targetDifficulty: 1, reason: 'Continue practice using the stored concept evidence.' };
    let intervention = decision && decision.action !== 'advance' && session.feedback.analysis?.source === 'live';
    const state = await states();
    let item = stillDiagnostic ? diagnostics[index] : selectPractice(state, content.bank, content.graph, await selectionOptions(session.recentIds))?.item;
    const conceptId = intervention ? decision.conceptId : item?.conceptIds[0];
    let generated = false;
    if (conceptId && (intervention || !stillDiagnostic)) {
      const previous = await resolveItem(session.itemId);
      try {
        const previousPlans = await store.all<GeneratedQuestion>('tutor.generated');
        const followUp = await generate({ conceptId, difficulty: intervention ? decision.targetDifficulty : item?.difficulty ?? 1,
          goal: intervention ? decision.reason : 'Practice a weaker or unobserved concept at the calibrated difficulty.',
          misconceptionTag: intervention ? decision.tag : undefined,
          principle: intervention ? content.misconceptions.find(t => t.id === decision.tag)?.correctPrinciple : undefined,
          previousQuestion: previous?.stem ?? '', recentIds: previousPlans.map(f => f.key),
          recentPlans: previousPlans.slice(-10).map(f => ({ family: f.value.origin.family, parameters: f.value.origin.parameters, variant: f.value.origin.variant })) });
        if (followUp) {
          item = followUp; generated = true;
          await store.put({ namespace: 'tutor.generated', key: followUp.id, value: followUp, at: now(), sourceId: session.token });
        } else if (intervention) {
          item = selectPractice(state, content.bank.filter(i => i.conceptIds.includes(conceptId)), content.graph, await selectionOptions(session.recentIds))?.item;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        await save({ ...session, notice: error instanceof Error && error.name === 'TimeoutError'
          ? 'Groq question generation timed out. Your answer is saved. Retry Next question; no fixture was substituted.'
          : /HTTP 429/.test(message) ? 'Groq is rate-limiting requests. Your answer is saved. Wait a minute, then retry Next question.'
          : /failed validation|JSON|message content/.test(message) ? 'The generated question failed validation (format, physics or repeated content). Your answer is saved. Retry Next question.'
          : 'Groq could not be reached or rejected the request. Your answer is saved. Retry Next question.' });
        return view();
      }
    }
    if (!item) {
      item = stillDiagnostic ? diagnostics[index] : selectPractice(state, content.bank, content.graph, await selectionOptions(session.recentIds))?.item;
      intervention = false;
    }
    if (!item) throw new SessionError('No other questions are available.');
    await save({ ...session, mode: stillDiagnostic ? 'diagnostic' : 'practice', diagnosticIndex: session.mode === 'diagnostic' ? index : session.diagnosticIndex,
      itemId: item.id, token: randomUUID(), feedback: null, notice: undefined,
      purpose: intervention ? 'verification' : stillDiagnostic ? 'diagnostic' : 'practice',
      selectionReason: `${intervention ? decision.reason : stillDiagnostic ? 'Continue gathering diagnostic evidence across the syllabus.' : 'Targeting weaker or unobserved concept evidence at a suitable difficulty.'} ${generated ? 'Live Groq plan, independently solved and validated.' : 'Reviewed question bank for this concept and difficulty.'}` });
    return view();
  }
  return { view, start, answer, advance };
}
