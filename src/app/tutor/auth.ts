import { cookies } from 'next/headers';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { signIdentity, verifyIdentity, type Identity } from '@/lib/identity';
const LEARNER_COOKIE = 'redpen_learner';
const TEACHER_COOKIE = 'redpen_teacher';
const lifetime = 30 * 24 * 60 * 60 * 1000;
function secret() { const s = process.env.SESSION_SECRET ?? ''; if (s.length < 32) throw new Error('Configure SESSION_SECRET before starting a personal session.'); return s; }
export async function currentIdentity(role: Identity['role'] = 'learner') {
  const jar = await cookies(); const value = verifyIdentity(jar.get(role === 'teacher' ? TEACHER_COOKIE : LEARNER_COOKIE)?.value, process.env.SESSION_SECRET ?? '');
  return value?.role === role && value.cohort === (process.env.REDPEN_COHORT_ID ?? 'physics') ? value : null;
}
async function setIdentity(identity: Identity) {
  (await cookies()).set(identity.role === 'teacher' ? TEACHER_COOKIE : LEARNER_COOKIE, signIdentity(identity, secret()), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: Math.max(0, Math.floor((identity.expires - Date.now()) / 1000)),
  });
}
export async function clearTeacherSession() { (await cookies()).delete(TEACHER_COOKIE); }
export async function ensureLearner() {
  const existing = await currentIdentity(); if (existing) return existing;
  const identity: Identity = { id: randomUUID(), role: 'learner', cohort: process.env.REDPEN_COHORT_ID ?? 'physics', expires: Date.now() + lifetime };
  await setIdentity(identity); return identity;
}
export async function authenticateTeacher(code: string) {
  const expected = process.env.TEACHER_ACCESS_CODE ?? '';
  if (expected.length < 12) throw new Error('Configure a TEACHER_ACCESS_CODE of at least 12 characters.');
  const hash = (s: string) => createHash('sha256').update(s).digest();
  if (code.length > 256 || !timingSafeEqual(hash(code), hash(expected))) return false;
  await setIdentity({ id: randomUUID(), role: 'teacher', cohort: process.env.REDPEN_COHORT_ID ?? 'physics', expires: Date.now() + 8 * 60 * 60 * 1000 });
  return true;
}
