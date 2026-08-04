// Inscription — Banani screen "Création de compte" (SignUp.jsx, Phase 13).
// See .planning/banani/phase-13-signup-redesign.md for the full plan.
//
// Replaces the Phase-2 "glue" page (no Banani screen existed yet at the
// time). Branding panel shared with /login via <AuthBrandingPanel />.
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { AuthBrandingPanel } from '@/components/marketing/AuthBrandingPanel';

const googleSignInHref = '/api/auth/oauth/google/start?next=/onboarding/profile';

// Stable error codes the signup route can return, mapped to French copy —
// CLAUDE.md convention is to switch on ApiError.code, not the (English)
// server message.
const ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_BANNED: 'Ce mot de passe est trop courant, choisissez-en un autre.',
  PASSWORD_TOO_SHORT: 'Le mot de passe doit contenir au moins 10 caractères.',
  PASSWORD_TOO_WEAK: 'Le mot de passe doit contenir au moins une majuscule et un chiffre.',
  PASSWORD_PWNED: 'Ce mot de passe est apparu dans une fuite de données connue.',
  TOO_MANY_SIGNUP_ATTEMPTS: 'Trop de tentatives. Réessayez plus tard.',
  VALIDATION_FAILED: 'Merci de vérifier les champs du formulaire.',
};

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/signup', {
        method: 'POST',
        body: { name, institution, email, password, termsAccepted },
      });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError('Une erreur est survenue');
      }
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
            <h1 className="mb-1 font-headings text-2xl font-semibold text-foreground">
              Créer un compte
            </h1>
            <p className="text-sm text-muted-foreground">
              Rejoignez ThèseFacile pour gérer vos mémoires
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Nom et prénom
              </span>
              <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-3">
                <Icon i="user" size={14} className="shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Amadou Diallo"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Établissement / Université
              </span>
              <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-3">
                <input
                  type="text"
                  required
                  autoComplete="organization"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Ex. Université Cheikh Anta Diop de Dakar"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>

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
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Au moins 10 caractères, avec une majuscule et un chiffre.
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Confirmer le mot de passe
              </span>
              <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-3">
                <Icon i="lock" size={14} className="shrink-0 text-muted-foreground" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                />
              </div>
              {passwordsMismatch && (
                <span className="text-xs text-danger">Les mots de passe ne correspondent pas.</span>
              )}
            </label>

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded-sm border-2 border-border"
              />
              <span className="text-xs text-muted-foreground">
                J&apos;accepte les{' '}
                <Link href="/terms" className="font-medium text-primary">
                  conditions d&apos;utilisation
                </Link>{' '}
                et la{' '}
                <Link href="/terms" className="font-medium text-primary">
                  politique de confidentialité
                </Link>
              </span>
            </label>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || passwordsMismatch || !termsAccepted}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Icon i="user-plus" size={14} />
              {submitting ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <a
            href={googleSignInHref}
            className="flex w-full items-center justify-center gap-2.5 rounded-sm border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground"
          >
            <Icon i="chrome" size={16} className="text-muted-foreground" />
            S&apos;inscrire avec Google
          </a>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Vous avez déjà un compte ?{' '}
            <Link href="/login" className="font-medium text-primary">
              Se connecter
            </Link>
          </p>

          <div className="mt-8 flex items-start gap-3 rounded-sm border border-border bg-input p-3">
            <Icon i="info" size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Les Professeurs doivent s&apos;inscrire avec une adresse email institutionnelle. Les
              Étudiants peuvent utiliser l&apos;email de leur université ou personnel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
