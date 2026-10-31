import { callLlm, type LlmRequest } from '@/platform/llm';
import type { Item, Misconception } from '@/lib/content';
import { candidateMisconceptions, noMisconception, validateClassification, type Classification, type ReasoningAnalysis } from '@/lib/misconception';
import cases from '../../../mocks/tutor.classify.cases.json';

export interface ClassificationInput { item: Item; answer: string; reasoning: string; correct: boolean }
export type Classifier = (input: ClassificationInput, taxonomy: Misconception[]) => Promise<ReasoningAnalysis>;
/** IO is outside pure src/lib. Unknown fixture inputs conservatively diagnose nothing. */
export function createReasoningClassifier(testHooks: Pick<LlmRequest, 'cwd' | 'fetchImpl'> = {}): Classifier {
  return async ({ item, answer, reasoning, correct }, taxonomy) => {
    const candidates = candidateMisconceptions(item, taxonomy);
    if (correct || candidates.length === 0) return { ...noMisconception(), source: 'not-needed', attempts: 0, fallback: false };
    const variant = cases.find(c => c.itemId === item.id && c.reasoning === reasoning.trim())?.variant;
    try {
      const result = await callLlm<Classification>({ prompt: 'tutor.classify', mockVariant: variant,
        input: { question: item.stem, correctAnswer: item.answer, studentAnswer: answer, reasoning, candidates },
        validate: v => validateClassification(v, candidates, reasoning), ...testHooks });
      // Gateway mocks and fallbacks must satisfy the same evidence rules as a live response.
      if (validateClassification(result.data, candidates, reasoning)) throw new Error('Invalid classification fixture');
      const candidate = candidates.find(c => c.id === result.data.tag);
      return { ...result.data, correctPrinciple: candidate?.correctPrinciple ?? null,
        remediationHint: candidate?.remediationHint ?? noMisconception().remediationHint,
        source: result.source, attempts: result.attempts, fallback: result.source === 'mock' && process.env.MOCK_LLM !== '1' };
    } catch {
      return { ...noMisconception(), source: 'unavailable', attempts: 0, fallback: false };
    }
  };
}
export const classifyReasoning = createReasoningClassifier();
