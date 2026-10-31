import { createHmac, timingSafeEqual } from 'node:crypto';
export interface Identity { id: string; role: 'learner' | 'teacher'; cohort: string; expires: number }
export function signIdentity(identity: Identity, secret: string): string {
  if (secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const body = Buffer.from(JSON.stringify(identity)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function verifyIdentity(token: string | undefined, secret: string, now = Date.now()): Identity | null {
  if (!token || token.length > 2048 || secret.length < 32) return null;
  const [body, signature, extra] = token.split('.'); if (!body || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(body).digest(); const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString()) as Identity;
    return /^[a-f0-9-]{36}$/.test(value.id) && ['learner', 'teacher'].includes(value.role) && typeof value.cohort === 'string'
      && /^[a-zA-Z0-9_-]{1,64}$/.test(value.cohort) && Number.isFinite(value.expires) && value.expires > now ? value : null;
  } catch { return null; }
}
