import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export interface LlmRequest {
  /** Prompt name, e.g. 'meetings.extract' → prompts/meetings.extract.md (+ mocks/meetings.extract.json). */
  prompt: string;
  /** Structured input; sent as the user message JSON. The prompt file is the system message. */
  input: unknown;
  /** Returns an error string when the parsed payload is invalid, or null when it is acceptable. */
  validate?: (value: unknown) => string | null;
  timeoutMs?: number;
  /** Optional fixture suffix; the live prompt stays unchanged. */
  mockVariant?: string;
  /** Test hooks only — product code never passes these. */
  cwd?: string;
  fetchImpl?: typeof fetch;
}

export interface LlmResult<T> {
  data: T;
  /** 'mock' means either MOCK_LLM=1 or a live failure fell back to the fixture — show a badge, never hide it. */
  source: 'live' | 'mock';
  attempts: number;
}

class LlmError extends Error {}

async function readPrompt(cwd: string, name: string): Promise<string> {
  try {
    return await readFile(path.join(cwd, 'prompts', `${name}.md`), 'utf8');
  } catch {
    throw new LlmError(`Missing prompt file prompts/${name}.md — prompts live in files, never in components.`);
  }
}

async function readMock<T>(cwd: string, name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(cwd, 'mocks', `${name}.json`), 'utf8')) as T;
  } catch {
    return null;
  }
}

function parseJsonPayload(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

/**
 * The only way product code talks to a model (AGENTS.md §3).
 * MOCK_LLM=1 short-circuits to the registered fixture so the demo never depends
 * on the network; live failures retry once, then fall back to the fixture and
 * report source:'mock' so the UI can disclose it.
 */
export async function callLlm<T>(req: LlmRequest): Promise<LlmResult<T>> {
  const cwd = req.cwd ?? process.cwd();
  const timeoutMs = req.timeoutMs ?? 20000;
  if (req.mockVariant && !/^[a-z0-9-]+$/.test(req.mockVariant)) throw new LlmError('Invalid mock variant.');
  const mockName = req.mockVariant ? `${req.prompt}.${req.mockVariant}` : req.prompt;
  const mock = await readMock<T>(cwd, mockName);

  if (process.env.MOCK_LLM === '1') {
    if (mock === null) {
      throw new LlmError(`MOCK_LLM=1 but mocks/${mockName}.json is missing. Register a fixture for every prompt.`);
    }
    return { data: mock, source: 'mock', attempts: 0 };
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    if (mock !== null) return { data: mock, source: 'mock', attempts: 0 };
    throw new LlmError('LLM_API_KEY is not set and no mock fixture exists. Copy .env.example to .env.local.');
  }

  const system = await readPrompt(cwd, req.prompt);
  const base = (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';
  const doFetch = req.fetchImpl ?? fetch;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await doFetch(`${base}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: typeof req.input === 'string' ? req.input : JSON.stringify(req.input, null, 2),
            },
          ],
        }),
      });
      if (!response.ok) throw new LlmError(`LLM HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new LlmError('LLM response had no message content');
      const parsed = parseJsonPayload(content);
      const invalid = req.validate?.(parsed) ?? null;
      if (invalid) throw new LlmError(`LLM payload failed validation: ${invalid}`);

      if (process.env.CACHE_LLM === '1') {
        // Best-effort fixture capture (dev only; read-only filesystems just skip it).
        await mkdir(path.join(cwd, 'mocks'), { recursive: true })
          .then(() => writeFile(path.join(cwd, 'mocks', `${mockName}.json`), JSON.stringify(parsed, null, 2)))
          .catch(() => undefined);
      }
      return { data: parsed as T, source: 'live', attempts: attempt };
    } catch (error) {
      lastError = error;
    }
  }

  if (mock !== null) {
    console.warn(`[platform/llm] ${req.prompt} fell back to mock after retries:`, lastError);
    return { data: mock, source: 'mock', attempts: 2 };
  }
  throw lastError instanceof Error ? lastError : new LlmError(String(lastError));
}
