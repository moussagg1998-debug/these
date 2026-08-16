// Generic confirmation dialog for critical/irreversible actions (logout,
// onboarding role choice, blocking a thesis, removing a student, …) — see
// each call site for the specific consequences copy. Replaces ad-hoc
// window.confirm() calls with a styled, accessible modal consistent with
// PasswordSettingsModal/AddToCalendarModal's shell.
'use client';

import { useEffect, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  confirmBusyLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  error?: string | null;
  /** Optional extra content (e.g. a reason field) rendered above the buttons. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = 'Confirmer',
  confirmBusyLabel = 'Un instant…',
  cancelLabel = 'Annuler',
  tone = 'danger',
  busy = false,
  error = null,
  children,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 motion-safe:animate-fade-in"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-description"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 motion-safe:animate-scale-in"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              tone === 'danger'
                ? 'bg-danger/10 text-danger'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <Icon i="alert-triangle" size={18} />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h2
              id="confirm-modal-title"
              className="text-sm font-semibold font-headings text-foreground"
            >
              {title}
            </h2>
            <p
              id="confirm-modal-description"
              className="mt-1.5 text-sm text-muted-foreground leading-relaxed"
            >
              {description}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {children}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-sm disabled:opacity-50 transition-colors duration-150 hover:bg-input"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm font-medium rounded-sm disabled:opacity-50 transition duration-150 motion-safe:active:scale-[0.98] ${
              tone === 'danger'
                ? 'bg-danger text-danger-foreground'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {busy ? confirmBusyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
