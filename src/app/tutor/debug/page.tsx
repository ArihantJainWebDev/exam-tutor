import { getStore } from '@/platform';
import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

/** The "not magic" screen: raw learner-model state with versions, timestamps and provenance. */
export default async function DebugPage() {
  const store = getStore();
  const namespaces = await store.namespaces();
  const sections = await Promise.all(
    namespaces.map(async (ns) => ({ ns, facts: await store.all(ns) })),
  );

  return (
    <main className="doc">
      <Nav />
      <h1 style={{ fontSize: 26, fontWeight: 500, margin: '0 0 4px' }}>Learner model</h1>
      <p className="mono" style={{ marginTop: 0 }}>
        latest version per key · data/store.json · reset with npm run seed
      </p>

      {sections.length === 0 ? (
        <div className="empty">Store is empty. Answer a question in phase T2 and the evidence trail appears here.</div>
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
