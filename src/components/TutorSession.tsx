'use client';
import { useState, useTransition } from 'react';
import type { SessionView } from '@/app/tutor/session-service';
import { startSession, submitAnswer, nextItem } from '@/app/tutor/actions';

export function TutorSession({ initial }: { initial: SessionView }) {
  const [view, setView] = useState(initial);
  const [answer, setAnswer] = useState(''); const [reasoning, setReasoning] = useState('');
  const [error, setError] = useState(''); const [pending, startTransition] = useTransition();
  function run(work: () => Promise<SessionView>) {
    setError(''); startTransition(async () => {
      try { const next = await work(); setView(next); if (next.token !== view.token) { setAnswer(''); setReasoning(''); } }
      catch { setError('Could not save this step. Check your connection and retry, or reload to resume.'); }
    });
  }
  const q = view.question; const feedback = view.feedback;
  return <>
    <p className="mono">One shared demo learner · progress is saved on this server.</p>
    {view.mode === 'welcome' ? <section>
      <h2>Find your starting point</h2>
      <p>Answer eight short questions across five physics chapters, then practice the concepts that need attention. Explain why you chose each answer.</p>
      <p>Sources of Energy is included as legacy extension practice.</p>
      <div className="session-actions">
        <button className="btn" disabled={pending} onClick={() => run(() => startSession('diagnostic'))}>Start diagnostic</button>
        <button className="btn btn-quiet" disabled={pending} onClick={() => run(() => startSession('practice'))}>Go straight to practice</button>
      </div>
    </section> : q && <>
      <p className="mono">{view.mode === 'diagnostic' ? `Diagnostic ${view.diagnosticIndex + 1} of 8` : 'Adaptive practice'} · {view.answered} answers saved</p>
      {view.mode === 'practice' && view.diagnosticIndex === 8 && <p>Diagnostic complete. Your answers now guide practice.</p>}
      <form key={view.token} onSubmit={e => { e.preventDefault(); if (view.token) run(() => submitAnswer(view.token!, answer, reasoning)); }}>
        <div className="qitem">
          <span className="qnum">Q{view.answered + (feedback ? 0 : 1)}.</span>
          <div className="question-body">
            <h2 className="question-stem">{q.stem}</h2>
            <p className="mono">{view.mode === 'diagnostic' ? 'Initial check' : 'Targeted practice'} · {view.selection?.conceptId} · {view.selection?.mastery === null ? 'no evidence yet' : `mastery ${Math.round((view.selection?.mastery ?? 0) * 100)}%`} · difficulty {q.difficulty}</p>
            {view.mode === 'practice' && !view.selection?.readiness && <p className="mono">Prerequisites need more evidence; this selection uses a readiness bonus, not a strict gate.</p>}
            <fieldset disabled={pending || Boolean(feedback)} className="answer-options">
              <legend>Choose an answer</legend>
              {q.options.map(option => <label key={option} className="answer-option student"><input type="radio" name="answer" value={option} required checked={(feedback?.selectedAnswer ?? answer) === option} onChange={e => setAnswer(e.target.value)} /> <span>{option}</span></label>)}
            </fieldset>
            <label className="reasoning-label" htmlFor="reasoning">{q.reasoningPrompt}</label>
            <textarea id="reasoning" className="reasoning-input student" value={feedback?.reasoning ?? reasoning} onChange={e => setReasoning(e.target.value)} required maxLength={4000} disabled={pending || Boolean(feedback)} rows={4} />
            {!feedback && <button className="btn" disabled={pending || !answer || !reasoning.trim()} type="submit">{pending ? 'Saving…' : 'Check answer'}</button>}
          </div><span className="qmarks">[{q.marks}]</span>
        </div>
      </form>
      {feedback && <section className="answer-feedback" aria-live="polite">
        <h2>{feedback.correct ? 'Correct' : 'Let’s review this answer'}</h2>
        <p>Answer: <strong>{feedback.answer}</strong></p><p>{feedback.explanation}</p>
        {feedback.changes.map(c => <p className="mono" key={c.conceptId}>{c.conceptId}: {Math.round(c.before * 100)}% → {Math.round(c.after * 100)}%</p>)}
        <p className="mono">First answers start from a neutral 50% prior, not a measured score. Reasoning is saved; misconception analysis arrives in Phase 3.</p>
        <button className="btn" disabled={pending} onClick={() => run(() => nextItem(view.token!))}>{pending ? 'Loading…' : view.mode === 'diagnostic' && view.diagnosticIndex === 7 ? 'Finish diagnostic and practice' : 'Next question'}</button>
      </section>}
    </>}
    {error && <p role="alert" className="session-error">{error}</p>}
    {pending && <p role="status" className="mono">Saving your progress…</p>}
    <section aria-label="Concept mastery" className="mastery-strip"><h2>Your concept evidence</h2>
      <p className="mono">Unanswered concepts have no estimate. Confidence grows over the first five answers per concept.</p>
      {view.mastery.map(c => <div key={c.conceptId} className="mastery-row"><span>{c.label}</span><span className="mono">{c.mastery === null ? 'no evidence' : `${Math.round(c.mastery * 100)}% · ${c.attempts} answers · confidence ${Math.round(c.confidence * 100)}%`}</span></div>)}
    </section>
  </>;
}
