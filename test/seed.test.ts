import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Fact } from '../src/platform/types';

test('seed CLI resets only its isolated target and never creates fictional class evidence', async () => {
  const parent = path.resolve('data'); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(path.join(parent, 'test-session-seed-')); const target = path.join(dir, 'store.json');
  try {
    const run = () => promisify(execFile)(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/seed.ts'], {
      cwd: process.cwd(), env: { ...process.env, REDPEN_DATA_FILE: target, REDPEN_STORE: 'file', VERCEL: '0' }, windowsHide: true,
    });
    await run(); const first = JSON.parse(await readFile(target, 'utf8')) as { facts: Fact[] };
    assert.equal(first.facts.filter(f => f.namespace === 'tutor.cohort.demo').length, 0);
    assert.equal(first.facts.filter(f => f.namespace === 'tutor.mastery' || f.namespace === 'tutor.attempt').length, 0);
    await run(); const next = JSON.parse(await readFile(target, 'utf8')) as { facts: Fact[] };
    assert.deepEqual(first.facts.filter(f => f.namespace === 'tutor.cohort.demo').map(f => f.value), next.facts.filter(f => f.namespace === 'tutor.cohort.demo').map(f => f.value));
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), parent);
    await rm(dir, { recursive: true, force: true });
  }
});
