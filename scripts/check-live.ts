import { loadPhysicsContent } from '../src/lib/content.server';
import { classifyReasoning } from '../src/app/tutor/classifier';
try { process.loadEnvFile('.env.local'); } catch { /* hosted environment uses process variables */ }
const content = await loadPhysicsContent();
const item = content.bank.find(i => i.id === 'light-01')!;
const reasoning = 'I measured the angle from the mirror surface, so I chose 30 degrees instead of measuring from the perpendicular.';
const result = await classifyReasoning({ item, answer: '30 degrees', reasoning, correct: false }, content.misconceptions);
if (result.source !== 'live') throw new Error('Expected a live response.');
console.log(JSON.stringify({ source: result.source, attempts: result.attempts, tag: result.tag, confidence: result.confidence, quote: result.quote }));
