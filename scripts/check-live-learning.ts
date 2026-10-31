import assert from 'node:assert/strict';
import { createMemoryStore } from '../src/platform/store/memory';
import { loadPhysicsContent } from '../src/lib/content.server';
import { createSessionService } from '../src/app/tutor/session-service';
import type { Item } from '../src/lib/content';
import { generateFollowUp } from '../src/app/tutor/generator';
try { process.loadEnvFile('.env.local'); } catch { /* deployment environment */ }
const store = createMemoryStore();
const content = await loadPhysicsContent();
await store.put({ namespace: 'tutor.session', key: 'demo', sourceId: 'live-check', at: new Date().toISOString(), value: {
  id: 'live-check', mode: 'practice', diagnosticIndex: 0, answered: 0, itemId: 'light-01', token: 'check', recentIds: [], feedback: null, purpose: 'practice' } });
const service = createSessionService(store, content, { generate: async input => {
  try { return await generateFollowUp(input); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    const safe = process.env.LLM_API_KEY ? message.replaceAll(process.env.LLM_API_KEY, '[redacted]') : message;
    console.log('[live] Generation rejected: ' + safe.slice(0, 300)); throw error;
  }
} });
let view = await service.answer({ token: 'check', answer: '30 degrees', reasoning: 'The angle of incidence is the angle to the mirror surface, so the given 30 degrees is the incidence angle.' });
assert.equal(view.feedback?.analysis?.source, 'live');
assert.equal(view.feedback?.analysis?.tag, 'm:angle-from-surface');
console.log('[live] Wrong reasoning diagnosed with verified quote.');
let successes = 0;
for (let check = 1; check <= 3 && successes < 2; check++) {
  const previousToken = view.token;
  view = await service.advance(view.token);
  assert.notEqual(view.token, previousToken, view.notice ?? 'Expected a genuinely new question');
  assert.equal(view.feedback, null, 'A previous response must never count as a new check');
  assert.equal(view.questionSource, 'live-generated', view.notice);
  const question = (await store.latest<Item>('tutor.generated', view.question!.id))!.value;
  view = await service.answer({ token: view.token, answer: String(question.answer), reasoning: question.explanation });
  assert.equal(view.feedback?.analysis?.source, 'live', JSON.stringify(view.feedback?.analysis));
  const analysis = view.feedback!.analysis!;
  const qualified = analysis.reasoningKind === 'sound' && (analysis.reasoningConfidence ?? analysis.confidence) >= 0.55;
  if (qualified) successes++;
  assert.equal(view.learning[0].successfulChecks, successes);
  console.log(`[live] Fresh question ${check}: reasoning=${analysis.reasoningKind}, reasoning confidence=${analysis.reasoningConfidence ?? analysis.confidence}, verified checks=${successes}.`);
}
assert.equal(successes, 2, 'Live model did not provide enough coherent evidence; do not claim improvement.');
assert.equal(view.learning[0].status, 'improvement-observed');
console.log('[live] Full correction/transfer loop passed. No user files or fixture outputs used.');
