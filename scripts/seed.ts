/** Explicit CLI reset only. Do not run against an active server's cached store. */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createMemoryStore } from '../src/platform/store/memory';
import { loadPhysicsContent } from '../src/lib/content.server';

await loadPhysicsContent();
const store = createMemoryStore();
const target = path.resolve(process.env.REDPEN_DATA_FILE ?? path.join('data', 'store.json'));
await mkdir(path.dirname(target), { recursive: true });
await writeFile(`${target}.tmp`, JSON.stringify({ facts: store.dump() }, null, 2));
await rename(`${target}.tmp`, target);
console.log('[seed] local learner evidence reset. No synthetic learners created.');
console.log('[seed] restart the server before continuing.');
