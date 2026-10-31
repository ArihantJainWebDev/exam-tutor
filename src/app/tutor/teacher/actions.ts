'use server';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { authenticateTeacher, clearTeacherSession } from '../auth';
import { getStore, withStoreTransaction } from '@/platform';
export async function unlockTeacher(code: string): Promise<{ ok: boolean; error?: string }> {
  const requestHeaders = await headers();
  const key = createHash('sha256').update((requestHeaders.get('x-forwarded-for') ?? 'local') + ':' + Math.floor(Date.now() / 600000)).digest('hex');
  const allowed = await withStoreTransaction(getStore(), async store => {
    const count = (await store.latest<number>('access.teacher', key))?.value ?? 0;
    if (count >= 5) return false;
    await store.put({ namespace: 'access.teacher', key, value: count + 1, at: new Date().toISOString(), sourceId: 'teacher-access' });
    return true;
  });
  if (!allowed) return { ok: false, error: 'Too many attempts. Wait ten minutes before trying again.' };
  try { return await authenticateTeacher(code) ? { ok: true } : { ok: false, error: 'Access code not accepted.' }; }
  catch { return { ok: false, error: 'Teacher access is not configured on this server.' }; }
}
export async function lockTeacher() { await clearTeacherSession(); }
