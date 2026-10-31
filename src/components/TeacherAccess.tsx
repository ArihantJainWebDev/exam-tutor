'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { unlockTeacher, lockTeacher } from '@/app/tutor/teacher/actions';
export function TeacherAccess() {
  const [code, setCode] = useState(''); const [error, setError] = useState('');
  const [pending, transition] = useTransition(); const router = useRouter();
  return <section><p>Teacher access is required to view class evidence. Student practice does not require signup.</p>
    <form onSubmit={e => { e.preventDefault(); transition(async () => {
      try { const result = await unlockTeacher(code); if (result.ok) router.refresh(); else setError(result.error ?? 'Access denied.'); }
      catch { setError('Could not verify access. Please retry.'); }
    }); }}>
      <label htmlFor="teacher-code">Teacher access code</label>
      <input id="teacher-code" type="password" autoComplete="current-password" required maxLength={256} value={code} onChange={e => setCode(e.target.value)} className="reasoning-input" />
      <button className="btn" disabled={pending}>{pending ? 'Checking…' : 'Open class dashboard'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </section>;
}
export function TeacherSignOut() {
  const router = useRouter(); const [pending, transition] = useTransition();
  return <button className="btn btn-quiet" disabled={pending} onClick={() => transition(async () => { await lockTeacher(); router.refresh(); })}>Lock teacher view</button>;
}
