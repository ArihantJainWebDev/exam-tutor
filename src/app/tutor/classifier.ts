import { callLlm, type LlmRequest } from '@/platform/llm';
import type { Item, Misconception } from '@/lib/content';
import { candidateMisconceptions, noMisconception, validateClassification, type Classification, type ReasoningAnalysis } from '@/lib/misconception';

export interface ClassificationInput { item: Item; answer: string; reasoning: string; correct: boolean }
export type Classifier = (input: ClassificationInput, taxonomy: Misconception[]) => Promise<ReasoningAnalysis>;
/** IO is outside pure src/lib. Unknown fixture inputs conservatively diagnose nothing. */
export function createReasoningClassifier(testHooks: Pick<LlmRequest, 'cwd' | 'fetchImpl' | 'fixtureMode' | 'mockVariant'> = {}): Classifier {
  return async ({ item, answer, reasoning, correct }, taxonomy) => {
    const candidates = candidateMisconceptions(item, taxonomy);
    if (testHooks.fixtureMode && correct) return { ...noMisconception(), source: 'not-needed', attempts: 0, fallback: false };
    try {
      const normalize = (v: unknown): unknown => {
        if (!v || typeof v !== 'object') return v;
        const raw = v as Record<string, unknown>; const candidate = candidates.find(c => c.id === raw.tag);
        return { ...raw, correctPrinciple: candidate?.correctPrinciple ?? null,
          remediationHint: candidate?.remediationHint ?? noMisconception().remediationHint,
          ...(raw.tag === 'none' ? { quote: null } : {}) };
      };
      const result = await callLlm<Classification>({ prompt: 'tutor.classify', timeoutMs: 45000,
        input: { question: item.stem, correctAnswer: item.answer, studentAnswer: answer, finalAnswerCorrect: correct, reasoning, candidates },
        validate: v => validateClassification(normalize(v), candidates, reasoning), ...testHooks });
      // Gateway mocks and fallbacks must satisfy the same evidence rules as a live response.
      const data = normalize(result.data) as Classification;
      if (validateClassification(data, candidates, reasoning)) throw new Error('Invalid classification response');
      const candidate = candidates.find(c => c.id === data.tag);
      return { ...data, reasoningKind: data.reasoningKind ?? (data.tag !== 'none' ? 'misconception' : 'uncertain'), correctPrinciple: candidate?.correctPrinciple ?? null,
        remediationHint: candidate?.remediationHint ?? noMisconception().remediationHint,
        source: result.source, attempts: result.attempts, fallback: result.source === 'mock' && process.env.MOCK_LLM !== '1' };
    } catch (error) {
      const e = error instanceof Error ? error : new Error('unknown');
      const unavailableReason = e.name === 'TimeoutError' ? 'timeout' : /validation|classification response/.test(e.message) ? 'validation' : /HTTP/.test(e.message) ? 'provider' : 'configuration-or-transport';
      return { ...noMisconception(), source: 'unavailable', attempts: 0, fallback: false, unavailableReason };
    }
  };
}
export const classifyReasoning = createReasoningClassifier();
