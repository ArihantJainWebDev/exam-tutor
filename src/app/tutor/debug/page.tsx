import { getStore } from '@/platform';
import { Nav } from '@/components/Nav';
import { currentIdentity } from '../auth';
import { getPersonalStore } from '@/platform/store/provider';
import { createMemoryStore } from '@/platform/store/memory';

export const dynamic = 'force-dynamic';

/** The "not magic" screen: raw learner-model state with versions, timestamps and provenance. */
export default async function DebugPage() {
  const identity = await currentIdentity();
  const store = identity ? getPersonalStore(identity.id) : createMemoryStore();
  const namespaces = (await store.namespaces()).filter(ns => ['tutor.mastery', 'tutor.attempt', 'tutor.learning', 'tutor.srs', 'tutor.misconception'].includes(ns));
  const sections = await Promise.all(
    namespaces.map(async (ns) => ({ ns, facts: await store.all(ns) })),
  );

  return (
    <main className="doc">
      <Nav />
      <h1 style={{ fontSize: 26, fontWeight: 500, margin: '0 0 4px' }}>Learner model</h1>
      <p className="mono" style={{ marginTop: 0 }}>
        Your evidence only · latest version per key · reset from Session
      </p>

      {sections.length === 0 ? (
        <div className="empty">Answer a question and your evidence trail appears here.</div>
      ) : (
        sections.map((section) => (
          <section key={section.ns} style={{ marginTop: 18 }}>
            <h2 className="mono" style={{ fontSize: 12, color: 'var(--p-ink)' }}>
              {section.ns} · {section.facts.length} keys
            </h2>
            <pre
              style={{
                fontFamily: 'var(--p-font-mono)',
                fontSize: 11,
                background: 'var(--p-cell)',
                padding: 12,
                overflowX: 'auto',
                border: '1px solid var(--p-rule)',
              }}
            >
              {JSON.stringify(section.facts, null, 2)}
            </pre>
          </section>
        ))
      )}
    </main>
  );
}
