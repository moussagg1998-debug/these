// Connexion — Banani screen "Connexion" (new_screen2.jsx).
// See .planning/banani/phase-2-auth-onboarding.md for the full plan.
//
// Branding panel is lg:+ only — Banani's 40%-width side panel doesn't fit
// 375px, so mobile shows just the form (the branding message isn't load-
// bearing for the login task itself).
'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, storeCsrfToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Icon } from '@/components/ui/Icon';
import { AuthBrandingPanel } from '@/components/marketing/AuthBrandingPanel';
import { AuthModeToggle } from '@/components/marketing/AuthModeToggle';

const googleSignInHref = '/api/auth/oauth/google/start?next=/onboarding/profile';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justReset = params.get('reset') === 'ok';
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

      // Route based on onboarding + profile status. /dashboard branches
      // internally on profileType (ENCADRANT since Phase 3, ETUDIANT since
      // Phase 7), so any resolved profile lands there.
      try {
        const profile = await api<{ profileType: string | null }>('/api/profile');
        if (!profile.profileType) router.push('/onboarding/profile');
        else router.push('/dashboard');
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
    <div className="flex h-dvh overflow-hidden font-body bg-background">
      <AuthBrandingPanel />

      {/* Form panel — its own scroll container (not the whole page): on a
          genuinely too-short viewport this scrolls in place rather than
          growing a page-level scrollbar or clipping content. `min-h-full`
          on the inner wrapper (not `items-center justify-center` on the
          scroll container itself) matters here — centering the scroll
          container directly clips the TOP of overflowing content with no
          way to scroll back up to it; centering an inner min-height box
          instead degrades to a normal top-anchored scroll when content
          doesn't fit. */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <div className="flex min-h-full items-center justify-center">
          <div className="w-full max-w-sm py-2">
            <div className="mb-4 lg:hidden">
              <img src="/logo.jpg" alt="ThèseFacile" className="h-8 w-auto" />
            </div>

            <div className="mb-5">
              <h1 className="mb-1 font-headings text-2xl font-semibold text-foreground">
                Bienvenue
              </h1>
              <p className="text-sm text-muted-foreground">Connectez-vous à ThèseFacile</p>
            </div>

            <AuthModeToggle mode="login" />

            {justReset && (
              <p
                role="status"
                className="mb-4 rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                Mot de passe réinitialisé. Vous pouvez vous connecter.
              </p>
            )}

            <a
              href={googleSignInHref}
              className="flex w-full items-center justify-center gap-2.5 rounded-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-input"
            >
              <Icon i="google" size={16} />
              Continuer avec Google
            </a>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Adresse email
                </span>
                <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-2.5 transition-colors duration-150 focus-within:border-primary">
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
                <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-2.5 transition-colors duration-150 focus-within:border-primary">
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
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 transition duration-150 motion-safe:active:scale-[0.98]"
              >
                <Icon i="log-in" size={14} />
                {submitting ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>

            <div className="mt-4 flex items-start gap-3 rounded-sm border border-border bg-input p-3">
              <Icon i="info" size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                ThèseFacile fonctionne pour les Professeurs et les Étudiants. Connectez-vous avec
                vos identifiants — le système vous redirigera automatiquement vers votre tableau de
                bord.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
