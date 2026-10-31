import Link from 'next/link';

/** Ladder-scoped nav: a route only appears here once its phase ships (AGENTS.md §6). */
export function Nav() {
  return (
    <nav className="topnav">
      <Link href="/tutor">
        <strong>REDPEN</strong>
      </Link>
      <Link href="/tutor">Session</Link>
      <Link href="/tutor/graph">Concepts</Link>
      <Link href="/tutor/teacher">Teacher</Link>
      <Link href="/tutor/debug">Model</Link>
      <span style={{ marginLeft: 'auto' }} className="mono">
        {process.env.MOCK_LLM === '1' ? 'MOCK_LLM=1 · fixtures' : 'Live requested · fallback disclosed'}
      </span>
    </nav>
  );
}
