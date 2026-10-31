import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
let text;
try { text = await readFile('.env.local', 'utf8'); } catch { text = await readFile('.env.example', 'utf8'); }
for (const key of ['SESSION_SECRET', 'TEACHER_ACCESS_CODE']) {
  if (!new RegExp(`^${key}=.+$`, 'm').test(text)) {
    const assignment = `${key}=${randomBytes(32).toString('hex')}`;
    const line = new RegExp(`^${key}=.*$`, 'm');
    text = line.test(text) ? text.replace(line, assignment) : text + `\n${assignment}\n`;
  }
}
await writeFile('.env.local', text);
console.log('Local session secrets configured. Set LLM_API_KEY in .env.local. Teacher access code stays in that private file; no credentials displayed.');
