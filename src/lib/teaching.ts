import type { ReasoningAnalysis } from './misconception';
import { detectedMisconception } from './misconception';
export interface LearningEvidence {
  status: 'verification-needed' | 'improvement-observed';
  tag: string | null;
  lastAttemptId: string;
  successfulChecks: number;
  successfulTasks?: string[];
}
export interface TeachingDecision {
  action: 'correct-misconception' | 'check-calculation' | 'clarify' | 'verify-understanding' | 'advance';
  conceptId: string;
  reason: string;
  targetDifficulty: 1 | 2 | 3;
  tag?: string;
}
export function teachingDecision(input: { analysis: ReasoningAnalysis; correct: boolean; conceptId: string; pending?: LearningEvidence }): TeachingDecision {
  const base = { conceptId: input.conceptId, targetDifficulty: 1 as const, ...(input.pending?.tag ? { tag: input.pending.tag } : {}) };
  if (detectedMisconception(input.analysis)) return { ...base, action: 'correct-misconception', tag: input.analysis.tag,
    reason: input.correct ? 'Your selected answer is correct, but your explanation suggests a conflicting principle. A different situation will check it.'
      : 'Your explanation identifies a specific misconception. Apply the correction in a different situation before moving on.' };
  if (input.analysis.source === 'unavailable') return { ...base, action: 'clarify', reason: 'Live reasoning analysis was unavailable. Your answer is saved; no misconception has been inferred.' };
  if (input.analysis.reasoningKind === 'slip') return { ...base, action: 'check-calculation', reason: 'Your reasoning suggests a calculation slip rather than a conceptual misconception. Check the calculation in a new example.' };
  if (input.analysis.reasoningKind !== 'sound' || (input.analysis.reasoningConfidence ?? input.analysis.confidence) < 0.55) return { ...base, action: 'clarify', reason: 'There is not enough clear reasoning evidence yet. A simpler probe will clarify the concept.' };
  if (!input.correct) return { ...base, action: 'check-calculation', reason: 'The selected answer is incorrect, while the stated principle appears sound. A fresh calculation will check the gap.' };
  if (input.pending?.status === 'verification-needed') return { ...base, action: 'verify-understanding', reason: 'Your answer and reasoning now agree. Verify the correction once more in a new situation.' };
  return { ...base, action: 'advance', targetDifficulty: 2, reason: 'This answer and explanation provide coherent evidence. Continue with the next learning priority.' };
}
