/** HTTP access/isolation checks with an ephemeral fixture file; no product demo mode. */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';
const parent = path.resolve('data'); await mkdir(parent, { recursive: true });
const dir = await mkdtemp(path.join(parent, 'test-smoke-'));
const file = path.join(dir, 'store.json');
const secret = 'isolated-http-check-secret-not-a-production-credential';
const a = randomUUID(), b = randomUUID(), c = randomUUID();
const facts = [];
function fact(namespace, key, value, sourceId = key) { facts.push({ id: randomUUID(), namespace, key, value, sourceId, version: 1, at: '2026-10-31T12:00:00.000Z' }); }
for (const [id, label, cohort, mastery] of [[a, 'Learner A', 'physics', 0.9], [b, 'Learner B', 'physics', 0.2], [c, 'OtherClassHidden', 'other', 0.1]]) {
  fact('learners.profile', id, { id, label, cohort });
  fact(`learner.${id}.tutor.mastery`, 'elec:current', { logit: Math.log(mastery / (1-mastery)), mastery, confidence: 0.2, attempts: 1, correctStreak: 0, lastAt: '2026-10-31T12:00:00Z', misconceptionStrength: {} });
  fact(`learner.${id}.tutor.attempt`, `${id}:1`, { itemId: 'elec-01', conceptIds: ['elec:current'], correct: true, reasoning: id === a ? 'A-private-evidence' : 'B-private-evidence' });
}
await writeFile(file, JSON.stringify({ facts }));
const cookie = (id, role = 'learner') => {
  const body = Buffer.from(JSON.stringify({ id, role, cohort: 'physics', expires: Date.now() + 3600000 })).toString('base64url');
  return `${role === 'teacher' ? 'redpen_teacher' : 'redpen_learner'}=${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
};
const port = process.env.SMOKE_PORT ?? '3182'; const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], {
  cwd: process.cwd(), env: { ...process.env, VERCEL: '0', REDPEN_STORE: 'file', REDPEN_DATA_FILE: file, SESSION_SECRET: secret, REDPEN_COHORT_ID: 'physics', TEACHER_ACCESS_CODE: 'isolated-test-access-code' },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let log = ''; child.stdout.on('data', b => { log = (log + b).slice(-6000); }); child.stderr.on('data', b => { log = (log + b).slice(-6000); });
const exited = new Promise(resolve => child.once('exit', resolve));
async function page(route, token) { const r = await fetch(base + route, { headers: token ? { cookie: token } : {}, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error(`${route}: HTTP ${r.status}`); return r.text(); }
try {
  let ready = false;
  for (let i = 0; i < 60; i++) { if (child.exitCode !== null) break; try { const r = await fetch(base + '/tutor', { signal: AbortSignal.timeout(1000) }); if (r.ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 500)); }
  if (!ready) throw new Error(`Server not reachable: ${log}`);
  if (!(await page('/tutor')).includes('Start diagnostic')) throw new Error('New guest must start without shared progress');
  const graphA = await page('/tutor/graph', cookie(a)), graphB = await page('/tutor/graph', cookie(b));
  if (!graphA.includes('90%') || graphA.includes('20%') || !graphB.includes('20%') || graphB.includes('90%')) throw new Error('Graph privacy check failed');
  const modelA = await page('/tutor/debug', cookie(a)), modelB = await page('/tutor/debug', cookie(b));
  if (!modelA.includes('A-private-evidence') || modelA.includes('B-private-evidence') || modelB.includes('A-private-evidence')) throw new Error('Model privacy check failed');
  if (!(await page('/tutor/teacher')).includes('Teacher access code')) throw new Error('Teacher must require access');
  const teacher = await page('/tutor/teacher?student=' + b, cookie(randomUUID(), 'teacher'));
  if (!teacher.includes('Class evidence:') || !teacher.includes('Learner B') || teacher.includes('OtherClassHidden') || teacher.includes('simulated profile')) throw new Error('Real teacher cohort check failed');
  const retired = await fetch(base + '/api/llm', { method: 'POST' }); if (retired.status !== 404) throw new Error('Generic model proxy is exposed');
  console.log('[smoke] New guest welcome; two learners isolated on Graph/Model; teacher gate and cohort filtering; retired proxy: passed.');
} finally {
  if (child.exitCode === null) child.kill(); await exited;
  if (path.dirname(path.resolve(dir)) !== parent) throw new Error('Invalid cleanup target');
  await rm(dir, { recursive: true, force: true });
}
