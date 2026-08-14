// Vérification email — glue page, NOT sourced from a Banani screen.
// Adapted from examples/frontend-pages/verify-email.tsx, retextured with
// ThèseFacile tokens. Redirects to /onboarding/profile (not /dashboard —
// no dashboards exist yet, and profileType must be chosen first).
'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, storeCsrfToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Icon } from '@/components/ui/Icon';

const RESEND_ERROR_MESSAGES: Record<string, string> = {
  TOO_MANY_RESEND_ATTEMPTS: 'Trop de tentatives. Réessayez dans quelques minutes.',
  RATE_LIMIT_UNAVAILABLE: 'Service de renvoi indisponible pour le moment. Réessayez plus tard.',
};

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    const qEmail = params.get('email');
    const qCode = params.get('code');
    if (qEmail && qCode) {
      void verify(qEmail, qCode);
    }
    // Intentionally empty deps — this must run once on mount only.
  }, []);

  async function verify(emailValue: string, codeValue: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ csrfToken?: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: { email: emailValue, code: codeValue },
      });
      if (res.csrfToken) storeCsrfToken(res.csrfToken);
      await refresh();
      router.push('/onboarding/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void verify(email, code);
  }

  async function onResend() {
    setResending(true);
    setResendMessage(null);
    setError(null);
    try {
      await api('/api/auth/resend-verification', { method: 'POST', body: { email } });
      setResendMessage('Si ce compte existe, un nouveau code a été envoyé.');
    } catch (err) {
      setResendMessage(
        err instanceof ApiError
          ? (RESEND_ERROR_MESSAGES[err.code] ?? err.message)
          : 'Une erreur est survenue',
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-14 font-body sm:px-8">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center">
          <img src="/logo.jpg" alt="ThèseFacile" className="h-8 w-auto" />
        </Link>

        <div className="mb-8">
          <h1 className="mb-1 font-headings text-2xl font-semibold text-foreground">
            Vérifiez votre email
          </h1>
          <p className="text-sm text-muted-foreground">
            Nous avons envoyé un code à 8 caractères. Il expire dans 10 minutes.
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
              Code de vérification
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
            {submitting ? 'Vérification…' : 'Vérifier mon email'}
          </button>
        </form>

        {resendMessage && (
          <p role="status" className="mt-4 text-center text-sm text-muted-foreground">
            {resendMessage}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas reçu de code ?{' '}
          <button
            type="button"
            onClick={onResend}
            disabled={resending || !email}
            className="font-medium text-primary disabled:opacity-50 transition-colors duration-150 hover:text-primary/80"
          >
            {resending ? 'Envoi…' : 'Renvoyer le code'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
