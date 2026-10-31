/** Guard generated function manifests across Windows/Linux path conventions. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const buildDir = process.env.REDPEN_BUILD_DIR ?? '.next';
async function traceFiles(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await traceFiles(file));
    else if (entry.name.endsWith('.nft.json')) result.push(file);
  }
  return result;
}
let removed = 0;
for (const file of await traceFiles(path.join(root, buildDir, 'server'))) {
  const trace = JSON.parse(await readFile(file, 'utf8'));
  const clean = trace.files.filter(entry => {
    const relative = path.relative(root, path.resolve(path.dirname(file), entry.replaceAll('\\', '/'))).replaceAll('\\', '/');
    return !(relative.startsWith('data/') || relative.startsWith('test/') || /^\.env(?:\.|$)/.test(relative));
  });
  if (clean.length !== trace.files.length) {
    removed += trace.files.length - clean.length;
    await writeFile(file, JSON.stringify({ ...trace, files: clean }));
  }
}
const tutorTrace = JSON.parse(await readFile(path.join(root, buildDir, 'server', 'app', 'tutor', 'page.js.nft.json'), 'utf8'));
const files = tutorTrace.files.map(file => file.replaceAll('\\', '/'));
for (const required of ['content/physics/graph.json', 'content/physics/bank.json', 'content/physics/misconceptions.json', 'prompts/tutor.classify.md', 'mocks/tutor.classify.json']) {
  if (!files.some(file => file.endsWith(required))) throw new Error(`Runtime file missing from deployment trace: ${required}`);
}
console.log(`[build] Runtime content/prompt/fixtures verified; removed ${removed} local data/test/env trace entries.`);
