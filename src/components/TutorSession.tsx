'use client';
import { useState, useTransition } from 'react';
import type { SessionView } from '@/app/tutor/session-service';
import { startSession, submitAnswer, nextItem, resetMyProgress } from '@/app/tutor/actions';
import { RedPenCard } from './RedPenCard';

const reviewDate = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));

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
    <p className="mono">Your private guest session · saved in this browser's identity. Your teacher can view class evidence.</p>
    {view.mode !== 'welcome' && <button className="btn btn-quiet" disabled={pending} onClick={() => { if (window.confirm('Erase only your learning progress and start again?')) run(resetMyProgress); }}>Reset my progress</button>}
    {view.mode === 'welcome' ? <section>
      <h2>Find your starting point</h2>
      <p>Answer eight short questions across five physics chapters, then practice the concepts that need attention. Explain why you chose each answer.</p>
      <p>Sources of Energy is included as legacy extension practice.</p>
      <div className="session-actions">
        <button className="btn" disabled={pending} onClick={() => run(() => startSession('diagnostic'))}>Start diagnostic</button>
        <button className="btn btn-quiet" disabled={pending} onClick={() => run(() => startSession('practice'))}>Go straight to practice</button>
      </div>
    </section> : q && <>
      <p className="mono">{view.purpose === 'verification' ? 'Targeted understanding check' : view.mode === 'diagnostic' ? `Diagnostic ${view.diagnosticIndex + 1} of 8` : 'Adaptive practice'} · {view.answered} answers saved</p>
      {view.mode === 'practice' && view.diagnosticIndex === 8 && <p>Diagnostic complete. Your answers now guide practice.</p>}
      <form key={view.token} onSubmit={e => { e.preventDefault(); if (view.token) run(() => submitAnswer(view.token!, answer, reasoning)); }}>
        <div className="qitem">
          <span className="qnum">Q{view.answered + (feedback ? 0 : 1)}.</span>
          <div className="question-body">
            <h2 className="question-stem">{q.stem}</h2>
            <p className="mono">{view.questionSource === 'live-generated' ? 'Live generated plan · independently validated answer' : 'Reviewed question bank'}</p>
            {view.taskLabel && <p><strong>Thinking task: {view.taskLabel}</strong></p>}
            {view.selectionReason && <p className="selection-explanation">Why this question: {view.selectionReason}</p>}
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
        <h2>{feedback.correct ? 'Correct choice' : 'Let’s review this answer'}</h2>
        <p>Answer: <strong>{feedback.answer}</strong></p><p>{feedback.explanation}</p>
        {feedback.changes.map(c => <p className="mono" key={c.conceptId}>{c.conceptId}: {Math.round(c.before * 100)}% → {Math.round(c.after * 100)}%</p>)}
        <p className="mono">First answers start from a neutral 50% prior. Mastery and model confidence are estimates.</p>
        {feedback.analysis && <RedPenCard analysis={feedback.analysis} />}
        {feedback.decision && <section className="teaching-step"><h3>Next teaching step</h3><p>{feedback.decision.reason}</p></section>}
        {feedback.reviews?.map(r => <p className="mono" key={r.conceptId}>Review {r.conceptId}: {reviewDate(r.dueAt)} IST{r.remediation ? ' · easier follow-up prioritised' : ''}</p>)}
        <button className="btn" disabled={pending} onClick={() => run(() => nextItem(view.token!))}>{pending ? 'Loading…' : view.mode === 'diagnostic' && view.diagnosticIndex === 7 ? 'Finish diagnostic and practice' : 'Next question'}</button>
      </section>}
    </>}
    {error && <p role="alert" className="session-error">{error}</p>}
    {view.notice && <p role="alert" className="session-error">{view.notice}</p>}
    {pending && <p role="status" className="mono">Saving your progress…</p>}
    <section className="review-queue" aria-label="Spaced revision">
      <h2>Spaced revision</h2>
      <p>{view.reviews.filter(r => r.due).length} concepts due now.</p>
      {view.reviews.length === 0 ? <p className="mono">Answer a question to schedule its concepts for revision.</p> : <>
        <p className="mono">Next review: {reviewDate(view.reviews[0].dueAt)} IST. Due concepts receive priority in practice.</p>
        <details><summary>Scheduled concepts ({view.reviews.length})</summary>
          {view.reviews.map(r => <div className="mastery-row" key={r.conceptId}><span>{r.label}{r.remediation ? ' · revisit the principle' : ''}</span><span className="mono">{r.due ? 'Due now' : reviewDate(r.dueAt) + ' IST'} · box {r.box + 1}/5</span></div>)}
        </details>
      </>}
    </section>
    <section aria-label="Concept mastery" className="mastery-strip"><h2>Your concept evidence</h2>
      {view.learning.filter(l => l.status === 'verification-needed').map(l => <p key={l.conceptId}>Verification needed: {l.conceptId} · {l.successfulChecks}/2 different thinking tasks verified.</p>)}
      {view.learning.filter(l => l.status === 'improvement-observed').map(l => <p key={l.conceptId}>Improvement observed: {l.conceptId}. Future review checks retention.</p>)}
      <p className="mono">Unanswered concepts have no estimate. Confidence grows over the first five answers per concept.</p>
      {view.mastery.map(c => <div key={c.conceptId} className="mastery-row"><span>{c.label}</span><span className="mono">{c.mastery === null ? 'no evidence' : `${Math.round(c.mastery * 100)}% · ${c.attempts} answers · confidence ${Math.round(c.confidence * 100)}%`}</span></div>)}
    </section>
  </>;
}
