/**
 * `npm run seed` — resets local demo state to a known starting point.
 * Phase T5 extends this to also generate the teacher cohort at a fixed seed so
 * the heatmap is identical on every take. Kept dependency-free on purpose.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');
await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, 'store.json'), JSON.stringify({ facts: [] }, null, 2));

console.log('[seed] learner model reset to empty.');
console.log('[seed] content is read from content/physics/*.json (phase T0 authors it).');
console.log('[seed] next: MOCK_LLM=1 npm run dev → http://localhost:3000/tutor');
