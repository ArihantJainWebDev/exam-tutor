import type { CSSProperties } from 'react';

export interface HeatmapProps {
  rows: { id: string; label: string }[];
  columns: { id: string; label: string }[];
  /** values[rowId][columnId] in 0..1. Missing values render as an empty, hatched cell. */
  values: Record<string, Record<string, number | undefined>>;
  format?: (value: number) => string;
}

/**
 * Unskinned grid used for the teacher dashboard (tutor) and any density view.
 * Colour comes from the host app's tokens: --p-heat (fill) and --p-cell (ground).
 */
export function Heatmap({ rows, columns, values, format }: HeatmapProps) {
  const fmt = format ?? ((v: number) => `${Math.round(v * 100)}`);
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', fontWeight: 400, padding: '4px 8px' }} />
          {columns.map((c) => (
            <th key={c.id} style={{ fontWeight: 400, padding: '4px 6px', color: 'var(--p-muted)' }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row" style={{ textAlign: 'left', fontWeight: 400, padding: '4px 8px' }}>
              {row.label}
            </th>
            {columns.map((col) => {
              const value = values[row.id]?.[col.id];
              const style: CSSProperties = {
                padding: '4px 6px',
                textAlign: 'center',
                border: '1px solid var(--p-rule)',
                fontVariantNumeric: 'tabular-nums',
                background:
                  value === undefined
                    ? 'var(--p-cell)'
                    : `color-mix(in srgb, var(--p-heat) ${Math.round(value * 100)}%, var(--p-cell))`,
                color: value !== undefined && value > 0.55 ? 'var(--p-paper)' : 'var(--p-ink)',
              };
              return (
                <td key={col.id} style={style} aria-label={`${row.label} / ${col.label}: ${value === undefined ? 'no data' : fmt(value)}`}>
                  {value === undefined ? '—' : fmt(value)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
