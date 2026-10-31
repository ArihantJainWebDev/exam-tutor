import { detectedMisconception, type ReasoningAnalysis } from '@/lib/misconception';

export function RedPenCard({ analysis }: { analysis: ReasoningAnalysis }) {
  if (analysis.source === 'not-needed') return null;
  const sound = analysis.reasoningKind === 'sound' && (analysis.reasoningConfidence ?? analysis.confidence) >= 0.55;
  return <aside className="redpen-card" aria-label="Reasoning feedback">
    <p className="mono">{analysis.source === 'live' ? 'Live model analysis' : analysis.source === 'mock'
      ? analysis.fallback ? 'Fixture fallback · live analysis unavailable' : 'Fixture analysis · scripted examples only'
      : 'Reasoning analysis unavailable'}</p>
    {detectedMisconception(analysis) ? <>
      <h3>A misconception to revisit</h3>
      <blockquote className="student">“{analysis.quote}”</blockquote>
      <p>{analysis.correctPrinciple}</p>
      <p className="pen">{analysis.remediationHint}</p>
      <p className="mono">{Math.round(analysis.confidence * 100)}% model confidence · estimate, not certainty</p>
    </> : <>
      <h3>{sound ? 'Reasoning is consistent' : analysis.reasoningKind === 'slip' ? 'Check the calculation' : 'Reasoning needs verification'}</h3>
      <p>{analysis.source === 'unavailable' ? `Your answer is saved. Live reasoning analysis is unavailable (${analysis.unavailableReason ?? 'request failed'}). No diagnosis was substituted.`
        : analysis.source === 'mock' ? 'No supported finding in this fixture response. This does not establish that your reasoning is correct.'
        : sound ? 'The stated reasoning is consistent with the principle checked. The next step uses this evidence.'
        : analysis.reasoningKind === 'slip' ? 'The principle appears sound, but the calculation needs another check.'
        : 'There is not enough evidence for a specific misconception. Walk through your reasoning again.'}</p>
    </>}
  </aside>;
}
