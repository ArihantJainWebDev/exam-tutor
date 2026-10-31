import { getStore } from '@/platform';
import { loadPhysicsContent } from '@/lib/content.server';
import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function TutorPage() {
  const { graph, bank } = await loadPhysicsContent();
  const mastery = await getStore().all('tutor.mastery');

  return (
    <main className="doc">
      <Nav />
      <h1 style={{ fontSize: 26, fontWeight: 500, margin: '0 0 4px' }}>Session</h1>
      <p className="mono" style={{ marginTop: 0 }}>
        answer → mastery update → next question targets the weakest concept
      </p>

      <div className="qitem">
        <span className="qnum">Q1.</span>
        <div>
          {bank && bank.length > 0 ? (
            <>
              <div style={{ fontSize: 17 }}>{bank[0].stem}</div>
              <div className="mono" style={{ marginTop: 6 }}>
                bank preview · {bank[0].conceptIds.join(', ')} · difficulty {bank[0].difficulty} — the
                interactive answer loop ships in phase T2
              </div>
            </>
          ) : (
            <span style={{ color: 'var(--p-muted)' }}>
              The question bank is not authored yet. Phase T0 writes{' '}
              <span className="mono">content/physics/graph.json</span> and{' '}
              <span className="mono">bank.json</span>; phase T2 wires the answer loop here.
            </span>
          )}
        </div>
        <span className="qmarks">[{bank[0]?.markAllocation ?? "�"}]</span>
      </div>

      <hr className="rule" />
      <p className="mono">
        content: {graph?.length ?? 0} concepts · {bank?.length ?? 0} items · learner model:{' '}
        {mastery.length} concepts with evidence
      </p>
    </main>
  );
}
