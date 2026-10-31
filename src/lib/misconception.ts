import type { Item, Misconception } from './content';
export const MISCONCEPTION_THRESHOLD = 0.55;
export interface Classification {
  reasoningKind?: 'sound' | 'misconception' | 'slip' | 'uncertain';
  reasoningConfidence?: number;
  tag: string;
  confidence: number;
  quote: string | null;
  correctPrinciple: string | null;
  remediationHint: string;
}
export interface ReasoningAnalysis extends Classification {
  unavailableReason?: 'timeout' | 'validation' | 'provider' | 'configuration-or-transport';
  source: 'live' | 'mock' | 'not-needed' | 'unavailable';
  attempts: number;
  fallback: boolean;
}
export const noMisconception = (): Classification => ({ tag: 'none', confidence: 0, quote: null,
  correctPrinciple: null, remediationHint: 'Explain the principle you used, then check each step.' });
export function candidateMisconceptions(item: Item, taxonomy: Misconception[]) {
  return taxonomy.filter(t => t.conceptIds.some(id => item.conceptIds.includes(id)));
}
export function validateClassification(value: unknown, candidates: Misconception[], reasoning: string): string | null {
  if (!value || typeof value !== 'object') return 'Expected classification object';
  const v = value as Record<string, unknown>;
  if (v.reasoningKind !== undefined && !['sound', 'misconception', 'slip', 'uncertain'].includes(String(v.reasoningKind))) return 'Invalid reasoning kind';
  if (v.reasoningConfidence !== undefined && (typeof v.reasoningConfidence !== 'number' || !Number.isFinite(v.reasoningConfidence) || v.reasoningConfidence < 0 || v.reasoningConfidence > 1)) return 'Invalid reasoning confidence';
  if (typeof v.tag !== 'string' || typeof v.confidence !== 'number' || !Number.isFinite(v.confidence) || v.confidence < 0 || v.confidence > 1) return 'Invalid tag or confidence';
  if (typeof v.remediationHint !== 'string' || !v.remediationHint.trim() || v.remediationHint.length > 1000) return 'Invalid hint';
  if (v.tag === 'none') return v.quote === null && v.correctPrinciple === null ? null : 'No diagnosis must have null evidence';
  const candidate = candidates.find(c => c.id === v.tag);
  if (v.reasoningKind !== undefined && v.reasoningKind !== 'misconception') return 'Tag requires misconception reasoning';
  if (!candidate) return 'Tag outside candidate set';
  if (typeof v.quote !== 'string' || !v.quote.trim() || !reasoning.includes(v.quote) || v.quote.trim().split(/\s+/).length > 25) return 'Evidence must quote at most 25 words verbatim';
  if (v.correctPrinciple !== candidate.correctPrinciple) return 'Principle must match the taxonomy';
  return null;
}
export const detectedMisconception = (analysis: Classification) =>
  analysis.tag !== 'none' && analysis.confidence >= MISCONCEPTION_THRESHOLD;
