import { NextResponse } from 'next/server';
import { callLlm } from '@/platform';

export const runtime = 'nodejs';

/**
 * Server-side model proxy so the API key never reaches the browser.
 * Prefer calling callLlm directly from server code (lib/misconception.ts in T4).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string; input?: unknown };
    if (!body.prompt || !/^[\w.-]+$/.test(body.prompt)) {
      return NextResponse.json({ error: 'a valid prompt name is required' }, { status: 400 });
    }
    const result = await callLlm({ prompt: body.prompt, input: body.input ?? {} });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'model call failed' },
      { status: 500 },
    );
  }
}
