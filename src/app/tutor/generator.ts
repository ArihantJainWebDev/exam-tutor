import { callLlm } from '@/platform';
import type { LlmRequest } from '@/platform/llm';
import { questionPlanSchema } from '@/lib/generated-question';
import { FAMILIES, buildGeneratedQuestion, type GeneratedQuestion } from '@/lib/generated-question';
import type { QuestionTask } from '@/lib/question-task';
export interface GenerationInput { conceptId: string; difficulty: 1 | 2 | 3; goal: string; previousQuestion: string; recentIds: string[]; recentPlans?: unknown[]; misconceptionTag?: string; principle?: string; task?: QuestionTask; previousTask?: QuestionTask }
export type QuestionGenerator = (input: GenerationInput) => Promise<GeneratedQuestion | null>;
export function createQuestionGenerator(testHooks: Pick<LlmRequest, 'fetchImpl' | 'cwd'> = {}): QuestionGenerator {
  return async input => {
    if (!FAMILIES[input.conceptId]) return null; // Unsupported concepts use clearly identified reviewed-bank practice.
    if (input.difficulty === 3) return null; // Advanced multi-concept items remain in the vetted bank.
    const focused: Record<string, string> = { 'm:current-consumed': 'series-current', 'm:series-voltage-same': 'series-voltage', 'm:angle-from-surface': 'reflection-angle',
      'm:power-is-energy': 'power-energy', 'm:myopia-convex': 'myopia', 'm:ignores-sign-convention': 'lens-power' };
    const family = input.misconceptionTag ? focused[input.misconceptionTag] : undefined;
    const allowedFamilies = family ? FAMILIES[input.conceptId].filter(f => f === family) : FAMILIES[input.conceptId];
    if (input.difficulty === 2 && (input.task ?? 'calculate') === 'calculate' && allowedFamilies.every(f => ['ohms-law', 'reflection-angle'].includes(f))) return null;
    if (allowedFamilies.length === 0) return null;
    const build = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a question plan');
      return buildGeneratedQuestion({ ...value, task: input.task ?? 'calculate' }, input.conceptId, input.difficulty);
    };
    if (input.task && input.task === input.previousTask) throw new Error('Repeated thinking task; choose a different task before generating');
    const result = await callLlm({ prompt: 'tutor.generate', timeoutMs: 45000, maxTokens: 1024, responseSchema: { name: 'physics_question_plan', schema: questionPlanSchema(allowedFamilies, input.recentPlans ?? []) }, ...testHooks, input: { ...input, allowedFamilies },
      validate: value => {
        try { const item = build(value); if (!allowedFamilies.includes(item.origin.family)) return 'Use the family for the diagnosed misconception'; return input.recentIds.includes(item.id) ? 'Choose a new parameter plan; this question was already used' : null; }
        catch (e) { return e instanceof Error ? e.message : 'Invalid generated plan'; }
      } });
    return build(result.data);
  };
}
export const generateFollowUp = createQuestionGenerator();
