// Settings → "Abonnement" tab — plan status card + entry point to
// UpgradeModal. GET /api/subscriptions/status is the single source of
// truth for what's displayed (never inferred from local state).
'use client';

import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { UpgradeModal } from './UpgradeModal';

interface SubscriptionStatus {
  plan: 'FREE' | 'ESSENTIEL';
  planExpiresAt: string | null;
  latestOrder: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    paidAt: string | null;
  } | null;
}

export function SubscriptionTab({ defaultName }: { defaultName: string }) {
  const { data, loading, refresh } = useApi<SubscriptionStatus>('/api/subscriptions/status');
  const [modalOpen, setModalOpen] = useState(false);

  if (loading || !data) {
    return (
      <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  const [firstNamePart, ...rest] = defaultName.trim().split(/\s+/);
  // noUncheckedIndexedAccess types firstNamePart as `string | undefined` even
  // though split() on a trimmed, non-empty name always yields >=1 element;
  // exactOptionalPropertyTypes then refuses to pass that through the
  // `defaultFirstName?: string` prop below without narrowing it here.
  const firstName = firstNamePart ?? '';
  const lastName = rest.join(' ');

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-surface p-6">
        <div className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Plan actuel
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="font-headings text-xl font-semibold text-foreground">
            {data.plan === 'ESSENTIEL' ? 'Essentiel' : 'Gratuit'}
          </span>
          {data.plan === 'ESSENTIEL' && (
            <span className="rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-gold-foreground">
              Actif
            </span>
          )}
        </div>
        {data.plan === 'ESSENTIEL' && data.planExpiresAt && (
          <p className="mb-4 text-sm text-muted-foreground">
            Valable jusqu&apos;au{' '}
            {new Date(data.planExpiresAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            .
          </p>
        )}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {data.plan === 'ESSENTIEL' ? 'Renouveler maintenant' : 'Passer au plan Essentiel'}
        </button>
      </div>

      {modalOpen && (
        <UpgradeModal
          defaultFirstName={firstName}
          defaultLastName={lastName}
          onClose={() => {
            setModalOpen(false);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
