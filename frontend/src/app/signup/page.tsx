// Inscription — glue page, NOT sourced from a Banani screen (none was
// designed in the fetched flow). Adapted from examples/frontend-pages/
// signup.tsx, retextured with the ThèseFacile tokens for visual continuity
// with Connexion / Landing Page. See phase-2-auth-onboarding.md § gap note.
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

const googleSignInHref = '/api/auth/oauth/google/start?next=/onboarding/profile';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/signup', { method: 'POST', body: { email, password } });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-14 font-body sm:px-8">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary">
            <Icon i="graduation-cap" size={14} className="text-primary-foreground" />
          </div>
          <span className="font-headings text-base font-semibold text-foreground">ThèseFacile</span>
        </Link>

        <div className="mb-8">
          <h1 className="mb-1 font-headings text-2xl font-semibold text-foreground">
            Créer un compte
          </h1>
          <p className="text-sm text-muted-foreground">14 jours d&apos;essai, sans carte</p>
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

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Mot de passe
            </span>
            <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-3">
              <Icon i="lock" size={14} className="shrink-0 text-muted-foreground" />
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground outline-none"
              />
            </div>
            <span className="text-xs text-muted-foreground">Au moins 8 caractères.</span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <a
          href={googleSignInHref}
          className="flex w-full items-center justify-center gap-2.5 rounded-sm border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground"
        >
          <Icon i="chrome" size={16} className="text-muted-foreground" />
          Continuer avec Google
        </a>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-medium text-primary">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
