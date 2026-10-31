'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Unskinned modal used by the confirmation gate. Deliberately plain: the host
 * product supplies buttons and payload preview, so approval UX cannot be restyled
 * into something that hides what is about to be posted.
 */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--p-ink) 35%, transparent)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'var(--p-paper)',
          color: 'var(--p-ink)',
          border: '1px solid var(--p-rule)',
          maxWidth: 560,
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ fontSize: 12 }}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 13 }}>{children}</div>
        {footer ? <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{footer}</div> : null}
      </div>
    </div>
  );
}
