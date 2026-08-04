// Choix du profil — Banani screen "Choix du profil" (new_screen6.jsx).
// See .planning/banani/phase-2-auth-onboarding.md for the full plan.
//
// Copy note: Banani's footer text ("vous pourrez changer de rôle
// ultérieurement depuis vos paramètres") isn't accurate today — /api/profile
// is a one-shot per the confirmed product decision, and no settings screen
// offers a role switch. Reworded to the honest version below.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api } from '@/lib/api';
import { useUser } from '@/contexts/AuthContext';
import { Icon } from '@/components/ui/Icon';

type ProfileType = 'ENCADRANT' | 'ETUDIANT';

const CARDS: Array<{
  value: ProfileType;
  icon: string;
  title: string;
  desc: string;
  features: string[];
}> = [
  {
    value: 'ENCADRANT',
    icon: 'book-open',
    title: 'Professeur',
    desc: "J'encadre des étudiants en master ou en thèse et je souhaite centraliser le suivi de leurs travaux.",
    features: ['Suivi des thèses & mémoires', 'Annotations et retours', 'Gestion des échéances'],
  },
  {
    value: 'ETUDIANT',
    icon: 'user',
    title: 'Étudiant',
    desc: 'Je prépare un mémoire ou une thèse et je souhaite collaborer efficacement avec mon encadrant.',
    features: ['Dépôt de chapitres', 'Suivi de mes retours', 'Visualisation de mon avancement'],
  },
];

export default function ProfileSelectionPage() {
  const user = useUser(); // redirects to /login if logged out
  const router = useRouter();
  const [selected, setSelected] = useState<ProfileType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  async function onContinue() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/profile', { method: 'PATCH', body: { profileType: selected } });
      // /dashboard branches internally on profileType (ENCADRANT since
      // Phase 3, ETUDIANT since Phase 7).
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PROFILE_ALREADY_SET') {
        router.push('/dashboard');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  }

  const ctaLabel =
    selected === 'ENCADRANT'
      ? 'Continuer en tant que Professeur'
      : selected === 'ETUDIANT'
        ? 'Continuer en tant qu’Étudiant'
        : 'Sélectionnez un profil pour continuer';

  return (
    <div className="flex min-h-screen flex-col bg-background font-body">
      <nav className="flex items-center justify-between border-b border-border px-4 py-5 sm:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary">
            <Icon i="graduation-cap" size={14} className="text-primary-foreground" />
          </div>
          <span className="font-headings text-base font-semibold text-foreground">ThèseFacile</span>
        </div>
      </nav>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-14 sm:px-8 lg:py-20">
        <div className="mb-10 text-center lg:mb-12">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <div className="h-px w-6 bg-primary" />
            Étape 1 sur 3
            <div className="h-px w-6 bg-primary" />
          </div>
          <h1 className="mb-3 font-headings text-2xl font-semibold text-foreground sm:text-3xl">
            Vous êtes…
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            Sélectionnez votre profil pour accéder à l&apos;expérience adaptée à votre rôle sur
            ThèseFacile.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Choix du profil"
          className="mb-10 flex w-full max-w-md flex-col gap-4 sm:max-w-none sm:flex-row sm:justify-center sm:gap-6"
        >
          {CARDS.map((card) => {
            const isSelected = selected === card.value;
            return (
              <div
                key={card.value}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => setSelected(card.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(card.value);
                  }
                }}
                className={`relative flex w-full cursor-pointer flex-col items-center gap-5 rounded-lg border-2 p-8 sm:w-72 ${
                  isSelected ? 'border-primary bg-secondary' : 'border-border bg-background'
                }`}
              >
                <div
                  className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full ${
                    isSelected ? 'bg-primary' : 'border-2 border-border bg-background'
                  }`}
                >
                  {isSelected && <Icon i="check" size={11} className="text-primary-foreground" />}
                </div>

                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-xl ${
                    isSelected ? 'bg-primary' : 'bg-input'
                  }`}
                >
                  <Icon
                    i={card.icon}
                    size={36}
                    className={isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}
                  />
                </div>

                <div className="text-center">
                  <div className="mb-1.5 font-headings text-lg font-semibold text-foreground">
                    {card.title}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{card.desc}</p>
                </div>

                <div className="flex w-full flex-col gap-1.5 border-t border-border pt-3">
                  {card.features.map((f) => (
                    <div
                      key={f}
                      className={`flex items-center gap-2 text-xs ${
                        isSelected ? 'text-secondary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <Icon
                        i="check"
                        size={11}
                        className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                      />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            disabled={submitting || !selected}
            className="flex items-center gap-2 rounded-sm bg-primary px-10 py-3.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : ctaLabel}
            <Icon i="arrow-right" size={14} />
          </button>
          <p className="text-xs text-muted-foreground">
            Ce choix est définitif — contactez le support si vous devez changer de rôle plus tard.
          </p>
        </div>

        <div className="mt-12 flex items-center gap-2">
          <div className="h-1.5 w-8 rounded-full bg-primary" />
          <div className="h-1.5 w-8 rounded-full bg-input" />
          <div className="h-1.5 w-8 rounded-full bg-input" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-12">
        <span>© 2025 ThèseFacile</span>
        <div className="flex items-center gap-5">
          <span>Confidentialité</span>
          <span>CGU</span>
          <span>Aide</span>
        </div>
      </div>
    </div>
  );
}
