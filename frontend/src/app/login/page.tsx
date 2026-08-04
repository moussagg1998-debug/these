// Connexion — Banani screen "Connexion" (new_screen2.jsx).
// See .planning/banani/phase-2-auth-onboarding.md for the full plan.
//
// Branding panel is lg:+ only — Banani's 40%-width side panel doesn't fit
// 375px, so mobile shows just the form (the branding message isn't load-
// bearing for the login task itself).
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, storeCsrfToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Icon } from '@/components/ui/Icon';
import { AuthBrandingPanel } from '@/components/marketing/AuthBrandingPanel';

const googleSignInHref = '/api/auth/oauth/google/start?next=/onboarding/profile';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ csrfToken?: string }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      if (res.csrfToken) storeCsrfToken(res.csrfToken);
      await refresh();

      // Route based on onboarding + profile status. ENCADRANT has a real
      // dashboard as of Phase 3; ETUDIANT doesn't yet (Phase 6), so it
      // still lands on the homepage for now.
      try {
        const profile = await api<{ profileType: string | null }>('/api/profile');
        if (!profile.profileType) router.push('/onboarding/profile');
        else if (profile.profileType === 'ENCADRANT') router.push('/dashboard');
        else router.push('/');
      } catch {
        router.push('/onboarding/profile');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen font-body bg-background">
      <AuthBrandingPanel />

      {/* Form panel */}
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

          <div className="mb-8">
            <h1 className="mb-1 font-headings text-2xl font-semibold text-foreground">Bienvenue</h1>
            <p className="text-sm text-muted-foreground">Connectez-vous à ThèseFacile</p>
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Mot de passe
                </span>
                <Link href="/forgot-password" className="text-xs text-primary">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-3">
                <Icon i="lock" size={14} className="shrink-0 text-muted-foreground" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
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
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Icon i="log-in" size={14} />
              {submitting ? 'Connexion…' : 'Se connecter'}
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
            Pas encore de compte ?{' '}
            <Link href="/signup" className="font-medium text-primary">
              Créer un compte
            </Link>
          </p>

          <div className="mt-8 flex items-start gap-3 rounded-sm border border-border bg-input p-3">
            <Icon i="info" size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              ThèseFacile fonctionne pour les Professeurs et les Étudiants. Connectez-vous avec vos
              identifiants — le système vous redirigera automatiquement vers votre tableau de bord.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
