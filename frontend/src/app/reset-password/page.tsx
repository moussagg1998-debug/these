// Réinitialisation du mot de passe — glue page, not sourced from a Banani
// screen. Retextured from examples/frontend-pages/reset-password.tsx with
// ThèseFacile tokens, styled to match /login and /signup. Reads `?email=`
// and `?code=` from the URL (the link in the reset email includes both).
//
// On success the user lands on /login — no auto-login, since a reset bumps
// tokenVersion server-side to invalidate any stolen sessions.
'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { AuthBrandingPanel } from '@/components/marketing/AuthBrandingPanel';

const ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_BANNED: 'Ce mot de passe est trop courant, choisissez-en un autre.',
  PASSWORD_TOO_SHORT: 'Le mot de passe doit contenir au moins 10 caractères.',
  PASSWORD_PWNED: 'Ce mot de passe est apparu dans une fuite de données connue.',
  VERIFICATION_CODE_INVALID: 'Ce code est invalide. Vérifiez-le ou demandez-en un nouveau.',
  VERIFICATION_CODE_EXPIRED: 'Ce code a expiré. Demandez-en un nouveau.',
  TOO_MANY_RESET_ATTEMPTS: 'Trop de tentatives. Réessayez dans 15 minutes.',
  VALIDATION_FAILED: 'Merci de vérifier les champs du formulaire.',
};

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: { email, code, newPassword },
      });
      router.push('/login?reset=ok');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ERROR_MESSAGES[err.code] ?? err.message)
          : 'Une erreur est survenue',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen font-body bg-background">
      <AuthBrandingPanel />

      <div className="flex flex-1 items-center justify-center px-4 py-14 sm:px-8 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <img src="/logo.jpg" alt="ThèseFacile" className="h-8 w-auto" />
          </div>

          <div className="mb-8">
            <h1 className="mb-1 font-headings text-2xl font-semibold text-foreground">
              Réinitialiser le mot de passe
            </h1>
            <p className="text-sm text-muted-foreground">
              Entrez le code reçu par email et choisissez un nouveau mot de passe.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Adresse email
              </span>
              <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-3">
                <Icon i="mail" size={14} className="shrink-0 text-muted-foreground" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Code de réinitialisation
              </span>
              <input
                type="text"
                required
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="rounded-sm border border-border bg-input px-3 py-3 font-mono text-sm uppercase tracking-widest text-foreground outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Nouveau mot de passe
              </span>
              <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-3">
                <Icon i="lock" size={14} className="shrink-0 text-muted-foreground" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                />
              </div>
              <span className="text-xs text-muted-foreground">Au moins 10 caractères.</span>
            </label>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50 transition duration-150 motion-safe:active:scale-[0.98]"
            >
              {submitting ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary">
              Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
