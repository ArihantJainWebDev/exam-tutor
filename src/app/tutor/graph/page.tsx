import { getStore } from '@/platform';
import { loadPhysicsContent } from '@/lib/content.server';
import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

interface MasteryValue {
  mastery: number;
  confidence?: number;
}

/** Concept graph with live mastery from the learner model. Nodes with no evidence stay unmarked, never invented. */
export default async function GraphPage() {
  const { graph } = await loadPhysicsContent();
  const masteryFacts = await getStore().all<MasteryValue>('tutor.mastery');
  const masteryByConcept = new Map(masteryFacts.map((f) => [f.key, f.value]));

  const chapters = [...new Set((graph ?? []).map((c) => c.chapter))];

  return (
    <main className="doc">
      <Nav />
      <h1 style={{ fontSize: 26, fontWeight: 500, margin: '0 0 4px' }}>Concept graph</h1>
      <p className="mono" style={{ marginTop: 0 }}>
        Class 10 Physics · prereq edges in content/physics/graph.json · mastery from tutor.mastery
      </p>

      {!graph ? (
        <div className="empty">No graph yet — phase T0 authors the 5 chapters and ~24 concepts.</div>
      ) : (
        chapters.map((chapter) => (
          <section key={chapter} style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 8px' }}>{chapter}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {graph
                .filter((c) => c.chapter === chapter)
                .map((concept) => {
                  const state = masteryByConcept.get(concept.id);
                  return (
                    <li
                      key={concept.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '7px 0',
                        borderBottom: '1px solid var(--p-rule)',
                      }}
                    >
                      <span>
                        {concept.label}
                        {concept.prereqs.length > 0 ? (
                          <span className="mono"> · after {concept.prereqs.join(', ')}</span>
                        ) : null}
                      </span>
                      <span className="mono">
                        {state ? `${Math.round(state.mastery * 100)}%` : 'no evidence'}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
