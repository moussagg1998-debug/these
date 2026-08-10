// Password change/set form, extracted from the generic /settings page's
// pre-existing logic (see phase-6-encadrant-settings.md § Confidentialité &
// Sécurité) into the modal shell shared by AddStudentForm/AddDeadlineForm.
// Same two endpoints, same hasPassword branch — no new backend behavior.
'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Mot de passe actuel incorrect.',
  PASSWORD_BANNED: 'Ce mot de passe est trop courant.',
  PASSWORD_TOO_SHORT: 'Mot de passe trop court.',
  PASSWORD_PWNED: 'Ce mot de passe a fuité — choisis-en un autre.',
  PASSWORD_ALREADY_SET: 'Un mot de passe est déjà défini. Utilise « changer le mot de passe ».',
  VALIDATION_FAILED: 'Champs invalides.',
};

interface PasswordSettingsModalProps {
  hasPassword: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function PasswordSettingsModal({
  hasPassword,
  onClose,
  onSuccess,
}: PasswordSettingsModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length === 0) {
      setError('Saisissez un nouveau mot de passe.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setSubmitting(true);
    try {
      if (hasPassword) {
        await api('/api/auth/change-password', {
          method: 'PUT',
          body: { currentPassword, newPassword },
        });
        onSuccess('Mot de passe mis à jour.');
      } else {
        await api('/api/auth/set-password', {
          method: 'POST',
          body: { newPassword },
        });
        onSuccess('Mot de passe défini. Vous pouvez maintenant vous connecter par email.');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError('Une erreur est survenue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 motion-safe:animate-fade-in">
      <div className="bg-surface rounded-lg shadow-2xl w-96 max-w-full motion-safe:animate-scale-in">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold font-headings text-foreground">
            {hasPassword ? 'Changer le mot de passe' : 'Définir un mot de passe'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition duration-150 hover:text-foreground motion-safe:active:scale-90"
            aria-label="Fermer"
          >
            <Icon i="x" size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 flex flex-col gap-4">
            {hasPassword && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Mot de passe actuel
                </span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Nouveau mot de passe
              </span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Confirmer le nouveau mot de passe
              </span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border bg-input flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-sm transition-colors duration-150 hover:bg-surface"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-sm disabled:opacity-50 transition duration-150 motion-safe:active:scale-[0.98]"
            >
              {submitting
                ? 'Enregistrement…'
                : hasPassword
                  ? 'Changer le mot de passe'
                  : 'Définir le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
