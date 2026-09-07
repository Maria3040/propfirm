'use client';

import { useEffect, useId } from 'react';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** In-app confirm dialog — replaces browser `confirm()` / `alert()` for approvals. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="pf-dialog-backdrop" role="presentation" onClick={() => !busy && onCancel()}>
      <div
        className="pf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-dialog-header">
          <h2 id={titleId}>{title}</h2>
          {description ? (
            <p id={descId} className="pf-dialog-desc">
              {description}
            </p>
          ) : null}
        </div>
        <div className="pf-dialog-footer">
          <button type="button" className="pf-dialog-cancel" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`pf-dialog-confirm${danger ? ' danger' : ''}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
        <button type="button" className="pf-dialog-x" aria-label="Close" disabled={busy} onClick={onCancel}>
          ×
        </button>
      </div>
    </div>
  );
}
