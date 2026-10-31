import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { callLlm } from '../src/platform/llm';

const ENV_KEYS = ['MOCK_LLM', 'LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL', 'CACHE_LLM'] as const;

function snapshotEnv() {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  return () => {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

async function fixtureDir() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'havk-llm-'));
  await mkdir(path.join(cwd, 'prompts'), { recursive: true });
  await mkdir(path.join(cwd, 'mocks'), { recursive: true });
  await writeFile(path.join(cwd, 'prompts', 'tutor.classify.md'), 'You extract decisions. JSON only.');
  await writeFile(
    path.join(cwd, 'mocks', 'tutor.classify.json'),
    JSON.stringify({ decisions: [{ statement: 'launch is 8 Nov' }] }),
  );
  return cwd;
}

const okResponse = (payload: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`` } }] }), {
    status: 200,
  });

const neverFetch: typeof fetch = async () => {
  throw new Error('network must not be touched in mock mode');
};

test('MOCK_LLM=1 serves the fixture and never calls the network', async () => {
  const restore = snapshotEnv();
  try {
    const cwd = await fixtureDir();
    process.env.MOCK_LLM = '1';
    const result = await callLlm<{ decisions: unknown[] }>({
      prompt: 'tutor.classify',
      input: { segments: [] },
      cwd,
      fetchImpl: neverFetch,
    });
    assert.equal(result.source, 'mock');
    assert.equal(result.data.decisions.length, 1);
  } finally {
    restore();
  }
});

test('MOCK_LLM=1 with no registered fixture fails loudly instead of inventing data', async () => {
  const restore = snapshotEnv();
  try {
    const cwd = await fixtureDir();
    process.env.MOCK_LLM = '1';
    await assert.rejects(
      callLlm({ prompt: 'tutor.explain', input: {}, cwd, fetchImpl: neverFetch }),
      /mocks\/tutor\.explain\.json is missing/,
    );
  } finally {
    restore();
  }
});

test('live mode parses fenced JSON and validates the payload', async () => {
  const restore = snapshotEnv();
  try {
    const cwd = await fixtureDir();
    delete process.env.MOCK_LLM;
    process.env.LLM_API_KEY = 'test-key';
    const payload = { decisions: [{ statement: 'launch is 8 Nov' }] };
    const result = await callLlm<typeof payload>({
      prompt: 'tutor.classify',
      input: { segments: [1, 2] },
      cwd,
      validate: (v) => (Array.isArray((v as { decisions?: unknown[] }).decisions) ? null : 'decisions missing'),
      fetchImpl: async () => okResponse(payload),
    });
    assert.equal(result.source, 'live');
    assert.equal(result.attempts, 1);
    assert.deepEqual(result.data, payload);
  } finally {
    restore();
  }
});

test('one retry on a validation failure, then success', async () => {
  const restore = snapshotEnv();
  try {
    const cwd = await fixtureDir();
    delete process.env.MOCK_LLM;
    process.env.LLM_API_KEY = 'test-key';
    let calls = 0;
    const result = await callLlm({
      prompt: 'tutor.classify',
      input: {},
      cwd,
      validate: (v) => (Array.isArray((v as { decisions?: unknown[] }).decisions) ? null : 'decisions missing'),
      fetchImpl: async () => {
        calls += 1;
        return okResponse(calls === 1 ? { nope: true } : { decisions: [] });
      },
    });
    assert.equal(calls, 2);
    assert.equal(result.attempts, 2);
    assert.equal(result.source, 'live');
  } finally {
    restore();
  }
});

test('live failure falls back to the fixture and reports source:mock', async () => {
  const restore = snapshotEnv();
  try {
    const cwd = await fixtureDir();
    delete process.env.MOCK_LLM;
    process.env.LLM_API_KEY = 'test-key';
    const result = await callLlm<{ decisions: unknown[] }>({
      prompt: 'tutor.classify',
      input: {},
      cwd,
      fetchImpl: async () => new Response('rate limited', { status: 429 }),
    });
    assert.equal(result.source, 'mock');
    assert.equal(result.attempts, 2);
    assert.equal(result.data.decisions.length, 1);
  } finally {
    restore();
  }
});
