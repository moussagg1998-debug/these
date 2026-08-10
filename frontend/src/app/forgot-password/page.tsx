// Mot de passe oublié — glue page, not sourced from a Banani screen (no
// such screen exists in the fetched flow). Retextured from
// examples/frontend-pages/forgot-password.tsx with ThèseFacile tokens,
// styled to match /login and /signup (AuthBrandingPanel + same form shell).
//
// Enumeration-resistant: the server always returns { ok: true } regardless
// of whether the email is registered (see /api/auth/forgot-password). The
// UI mirrors that — same confirmation screen either way, never reveals
// whether the account exists.
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { AuthBrandingPanel } from '@/components/marketing/AuthBrandingPanel';

const ERROR_MESSAGES: Record<string, string> = {
  TOO_MANY_FORGOT_ATTEMPTS: 'Trop de demandes pour cette adresse. Réessayez dans une heure.',
  VALIDATION_FAILED: 'Merci de vérifier votre adresse email.',
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setSubmitted(true);
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
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary">
              <Icon i="graduation-cap" size={14} className="text-primary-foreground" />
            </div>
            <span className="font-headings text-base font-semibold text-foreground">
              ThèseFacile
            </span>
          </div>

          {submitted ? (
            <>
              <div className="mb-8">
                <h1 className="mb-1 font-headings text-2xl font-semibold text-foreground">
                  Vérifiez votre email
                </h1>
                <p className="text-sm text-muted-foreground">
                  Si un compte existe pour <strong className="text-foreground">{email}</strong>,
                  vous recevrez un code de réinitialisation dans quelques instants.
                </p>
              </div>
              <Link
                href={`/reset-password?email=${encodeURIComponent(email)}`}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 text-sm font-medium text-primary-foreground"
              >
                J&apos;ai déjà mon code
              </Link>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-primary">
                  Retour à la connexion
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="mb-1 font-headings text-2xl font-semibold text-foreground">
                  Mot de passe oublié ?
                </h1>
                <p className="text-sm text-muted-foreground">
                  Entrez votre email, nous vous enverrons un code de réinitialisation.
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
                      placeholder="nom@universite.sn"
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
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
                  {submitting ? 'Envoi…' : 'Envoyer le code'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Vous avez déjà un code ?{' '}
                <Link href="/reset-password" className="font-medium text-primary">
                  Réinitialiser mon mot de passe
                </Link>
              </p>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-primary">
                  Retour à la connexion
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
