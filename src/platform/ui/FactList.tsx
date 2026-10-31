export interface FactListItem {
  id: string;
  primary: string;
  secondary?: string;
  /** Right-aligned mono meta: timestamp, version, provenance. */
  meta?: string;
}

/** Unskinned record list. The host product styles the surrounding document, not this component. */
export function FactList({ items, empty }: { items: FactListItem[]; empty?: string }) {
  if (items.length === 0) {
    return <p style={{ color: 'var(--p-muted)', fontSize: 13 }}>{empty ?? 'Nothing recorded yet.'}</p>;
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li
          key={item.id}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid var(--p-rule)',
          }}
        >
          <div>
            <div style={{ fontSize: 14 }}>{item.primary}</div>
            {item.secondary ? (
              <div style={{ fontSize: 12, color: 'var(--p-muted)', marginTop: 2 }}>{item.secondary}</div>
            ) : null}
          </div>
          {item.meta ? (
            <div
              style={{
                fontFamily: 'var(--p-font-mono)',
                fontSize: 11,
                color: 'var(--p-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {item.meta}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
