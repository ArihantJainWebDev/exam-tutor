import Link from 'next/link';
import { getStore } from '@/platform';
import { Heatmap, FactList } from '@/platform/ui';
import { Nav } from '@/components/Nav';
import { loadPhysicsContent } from '@/lib/content.server';
import { summarizeClass } from '@/lib/cohort';
import { loadRealCohort } from './real-cohort';
import { currentIdentity } from '../auth';
import { TeacherAccess, TeacherSignOut } from '@/components/TeacherAccess';
import { getPersonalStore } from '@/platform/store/provider';

export const dynamic = 'force-dynamic';
const percent = (n: number) => `${Math.round(n * 100)}%`;

export default async function TeacherPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const identity = await currentIdentity('teacher');
  if (!identity) return <main className="doc"><Nav /><h1>Teacher dashboard</h1><TeacherAccess /></main>;
  const content = await loadPhysicsContent();
  const learners = await loadRealCohort(getStore(), identity.cohort, getPersonalStore);
  if (learners.length === 0) return <main className="doc"><Nav /><h1>Teacher dashboard</h1><p>No learners have joined this class yet. Start a personal practice session to create real evidence.</p></main>;
  const summary = summarizeClass(learners, content);
  const requested = (await searchParams).student;
  const selected = learners.find(l => l.id === requested) ?? learners[0];
  const maxCount = Math.max(1, ...summary.misconceptions.map(m => m.count));
  return <main className="doc teacher-doc">
    <Nav /><h1>Teacher dashboard</h1><TeacherSignOut />
    <p className="cohort-disclosure">Class evidence: {learners.length} learners, {summary.totalAnswers} submitted answers. Estimates come from their saved attempts; unobserved concepts remain unknown.</p>
    <p className="mono">Authorised cohort: {identity.cohort}. Learners retain separate personal progress.</p>
    <div className="teacher-summary">
      <p><strong>{learners.length}</strong><span>Learners</span></p>
      <p><strong>{summary.totalAnswers}</strong><span>Submitted answers</span></p>
      <p><strong>{summary.totalAnswers ? percent(summary.correctAnswers / summary.totalAnswers) : 'No answers'}</strong><span>Answer accuracy</span></p>
      <p><strong>{summary.atRisk.length}</strong><span>Learners with supported risk flags</span></p>
    </div>
    <section><h2>Concept mastery across the class</h2>
      <p>Each cell shows estimated mastery (%). Darker blue means a higher estimate. Scroll horizontally for all learners.</p>
      <p className="mono">Early estimates may use only one or two answers. The gap ranking reports low-evidence counts.</p>
      <div className="teacher-heatmap" tabIndex={0} role="region" aria-label="Scrollable concept mastery heatmap">
        <Heatmap rows={content.graph.map(c => ({ id: c.id, label: c.label }))}
          columns={learners.map(l => ({ id: l.id, label: l.label.replace('Learner ', 'L') }))} values={summary.values} />
      </div>
    </section>
    <div className="teacher-columns">
      <section><h2>Class-wide gaps</h2>
        <p className="mono">Lowest mean mastery first. Low evidence means confidence &le;60%.</p>
        <FactList items={summary.gaps.map(g => ({ id: g.conceptId, primary: g.label,
          secondary: `${g.observed}/${learners.length} observed; ${g.lowEvidence} with low evidence`, meta: g.mean === null ? 'no evidence' : percent(g.mean) }))} />
      </section>
      <section><h2>Common misconceptions</h2>
        <p className="mono">Supported findings from saved live reasoning analysis.</p>
        {summary.misconceptions.slice(0, 5).map(m => <div className="misconception-frequency" key={m.id}>
          <div><span>{m.label}</span><strong>{m.count}</strong></div>
          <div className="frequency-track"><span style={{ width: `${m.count / maxCount * 100}%` }} /></div>
        </div>)}
        {summary.misconceptions.length === 0 && <p>No supported misconceptions recorded.</p>}
        <h2>Learners needing a closer look</h2>
        <p className="mono">Mastery &lt;35% with confidence &gt;60% on at least one concept.</p>
        {summary.atRisk.length === 0 ? <p>No supported risk flags in this cohort.</p> : <ul className="at-risk-list">
          {summary.atRisk.map(l => <li key={l.id}><Link href={`/tutor/teacher?student=${l.id}#student-detail`}>{l.label}</Link>
            <span>{l.concepts.map(c => c.label).join(', ')}</span></li>)}
        </ul>}
      </section>
    </div>
    <section id="student-detail" className="student-detail"><h2>Inspect a learner</h2>
      <form method="get" action="/tutor/teacher" className="session-actions">
        <label htmlFor="student">Learner</label>
        <select id="student" name="student" defaultValue={selected.id} className="teacher-select">
          {learners.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select><button className="btn" type="submit">Inspect learner</button>
      </form>
      <h3>{selected.label}</h3>
      <p>{selected.attempts.length} submitted answers</p>
      <p className="mono">Evidence belongs to the selected learner in this authorised class.</p>
      <FactList items={content.graph.map(c => ({ id: c.id, primary: c.label,
        secondary: `${selected.states[c.id]?.attempts ?? 0} answers; confidence ${percent(selected.states[c.id]?.confidence ?? 0)}`,
        meta: selected.states[c.id]?.attempts ? percent(selected.states[c.id].mastery) : 'no evidence' }))} />
      <details><summary>Evidence trail ({selected.attempts.length} submitted answers)</summary>
        <FactList items={selected.attempts.map(a => ({ id: a.id, primary: content.bank.find(i => i.id === a.itemId)?.stem ?? a.itemId,
          secondary: `${a.correct ? 'Correct' : 'Incorrect'}${a.misconception ? `; reasoning finding: ${a.misconception.tag}` : ''}`,
          meta: a.at }))} />
      </details>
    </section>
  </main>;
}
