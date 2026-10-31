import type { ReactNode } from 'react';

/**
 * The "this is not magic" footer (ARCHITECTURE §9). Every record shows where it
 * came from: meeting + segment, or concept + attempt. Cheap, and it is the
 * evidence that the system read something rather than invented it.
 */
export function Provenance({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--p-font-mono)',
        fontSize: 11,
        color: 'var(--p-muted)',
        marginTop: 6,
      }}
    >
      {children}
    </div>
  );
}
