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
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!user) {
    return <LoadingScreen />;
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
      setConfirmOpen(false);
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
    <div className="flex h-dvh flex-col overflow-hidden bg-background font-body">
      <nav className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3 sm:px-12">
        <div className="flex items-center">
          <img src="/logo.jpg" alt="ThèseFacile" className="h-8 w-auto" />
        </div>
      </nav>

      {/* Its own scroll container (not the whole page): on a genuinely too-
          short viewport this scrolls in place, while nav + footer stay
          pinned — never a page-level scrollbar or clipped content.
          `min-h-full` on the inner wrapper (not `items-center
          justify-center` on the scroll container itself) matters — centering
          the scroll container directly clips the TOP of overflowing content
          with no way to scroll back up to it. */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 lg:py-8">
        <div className="flex min-h-full flex-col items-center justify-center">
          <div className="mb-4 text-center sm:mb-6">
            <h1 className="mb-2 font-headings text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">
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
            className="mb-4 flex w-full max-w-md flex-col gap-3 sm:mb-6 sm:max-w-none sm:flex-row sm:justify-center sm:gap-6"
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
                  className={`relative flex w-full cursor-pointer flex-col items-center gap-2.5 rounded-lg border-2 p-4 sm:w-72 sm:gap-4 sm:p-6 lg:gap-5 lg:p-8 ${
                    isSelected ? 'border-primary bg-secondary' : 'border-border bg-background'
                  }`}
                >
                  <div
                    className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full sm:right-4 sm:top-4 ${
                      isSelected ? 'bg-primary' : 'border-2 border-border bg-background'
                    }`}
                  >
                    {isSelected && <Icon i="check" size={11} className="text-primary-foreground" />}
                  </div>

                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl sm:h-16 sm:w-16 lg:h-20 lg:w-20 ${
                      isSelected ? 'bg-primary' : 'bg-input'
                    }`}
                  >
                    <Icon
                      i={card.icon}
                      size={24}
                      className={isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}
                    />
                  </div>

                  <div className="text-center">
                    <div className="mb-1 font-headings text-base font-semibold text-foreground sm:mb-1.5 sm:text-lg">
                      {card.title}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{card.desc}</p>
                  </div>

                  <div className="flex w-full flex-col gap-1 border-t border-border pt-2 sm:gap-1.5 sm:pt-3">
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

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={submitting || !selected}
              className="flex items-center gap-2 rounded-sm bg-primary px-10 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50 transition duration-150 motion-safe:active:scale-[0.98]"
            >
              {submitting ? 'Enregistrement…' : ctaLabel}
              <Icon i="arrow-right" size={14} />
            </button>
            <p className="text-xs text-muted-foreground">
              Ce choix est définitif — contactez le support si vous devez changer de rôle plus tard.
            </p>
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:px-12">
        <span>© 2025 ThèseFacile</span>
        <div className="hidden items-center gap-5 sm:flex">
          <span>Confidentialité</span>
          <span>CGU</span>
          <span>Aide</span>
        </div>
      </div>

      {confirmOpen && selected && (
        <ConfirmModal
          title={`Continuer en tant que ${selected === 'ENCADRANT' ? 'Professeur' : 'Étudiant'} ?`}
          description="Ce choix est définitif — vous ne pourrez pas changer de rôle vous-même par la suite. Contactez le support si vous devez le modifier."
          confirmLabel="Confirmer mon choix"
          confirmBusyLabel="Enregistrement…"
          tone="primary"
          busy={submitting}
          onConfirm={() => void onContinue()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
