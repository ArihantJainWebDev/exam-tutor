import { getStore } from '@/platform';
import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

/**
 * Ladder item 4 (phase T5). The heatmap is rendered from lib/cohort.ts replaying
 * answers through the real mastery model — never from literals in this file.
 */
export default async function TeacherPage() {
  const store = getStore();
  const namespaces = await store.namespaces();
  const cohorts = namespaces.filter((ns) => ns.startsWith('tutor.cohort'));
  const counts = await Promise.all(cohorts.map(async (ns) => ({ ns, facts: await store.all(ns) })));

  return (
    <main className="doc">
      <Nav />
      <h1 style={{ fontSize: 26, fontWeight: 500, margin: '0 0 4px' }}>Teacher dashboard</h1>
      <p className="mono" style={{ marginTop: 0 }}>
        class-wide gaps · misconception frequency · at-risk learners
      </p>

      {counts.length === 0 ? (
        <div className="empty">
          No cohort simulated yet. Phase T5 runs 20 synthetic learners through the real{' '}
          <span className="mono">updateMastery</span> and renders the heatmap here — no hardcoded
          numbers, by design.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {counts.map((c) => (
            <li key={c.ns} style={{ padding: '8px 0', borderBottom: '1px solid var(--p-rule)' }}>
              <span className="mono">{c.ns}</span> · {c.facts.length} concepts tracked — heatmap and gap
              ranking render in phase T5
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
