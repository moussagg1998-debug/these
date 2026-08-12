// Chariow return page — the `redirect_url` Chariow sends the buyer back to
// after checkout, regardless of outcome (Chariow.md §3.1: Chariow has one
// universal redirect_url, no separate success/failure URL). This page NEVER
// concludes payment status from `?status=` or any other URL param — it
// polls POST /api/subscriptions/verify, which re-reconciles server-side
// against Chariow's own API before answering (Chariow.md §8).
'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

type PollState = 'pending' | 'success' | 'slow' | 'failed';

const POLL_INTERVAL_MS = 3_000;
const HARD_TIMEOUT_MS = 60_000;

function SubscribeReturnContent() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get('orderId');
  const [state, setState] = useState<PollState>('pending');
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!orderId) {
      setState('failed');
      return;
    }
    let cancelled = false;

    async function poll() {
      try {
        const res = await api<{ status: 'PAID' | 'PENDING' | 'FAILED' }>(
          '/api/subscriptions/verify',
          { method: 'POST', body: { orderId } },
        );
        if (cancelled) return;
        if (res.status === 'PAID') {
          setState('success');
          return;
        }
        if (res.status === 'FAILED') {
          setState('failed');
          return;
        }
        if (Date.now() - startRef.current > HARD_TIMEOUT_MS) {
          setState('slow');
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setState('failed');
          return;
        }
        if (Date.now() - startRef.current > HARD_TIMEOUT_MS) {
          setState('slow');
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (state !== 'success') return undefined;
    const t = setTimeout(() => router.push('/settings?tab=abonnement'), 2000);
    return () => clearTimeout(t);
  }, [state, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {state === 'pending' && (
        <>
          <Icon i="loader" size={32} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Vérification du paiement…</p>
        </>
      )}
      {state === 'slow' && (
        <>
          <Icon i="clock" size={32} className="text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Le paiement prend plus de temps que prévu à se confirmer. Votre abonnement sera activé
            automatiquement dès sa confirmation — pas besoin de repayer.
          </p>
          <Link
            href="/settings?tab=abonnement"
            className="text-sm font-medium text-primary underline"
          >
            Retour à mon espace
          </Link>
        </>
      )}
      {state === 'success' && (
        <>
          <Icon i="check-circle" size={32} className="text-success" />
          <p className="text-sm text-foreground">
            Paiement réussi — votre plan Essentiel est actif.
          </p>
        </>
      )}
      {state === 'failed' && (
        <>
          <Icon i="x" size={32} className="text-danger" />
          <p className="text-sm text-foreground">
            Le paiement a été annulé ou a échoué. Vous restez sur votre plan actuel.
          </p>
          <Link
            href="/settings?tab=abonnement"
            className="text-sm font-medium text-primary underline"
          >
            Réessayer
          </Link>
        </>
      )}
    </div>
  );
}

export default function SubscribeReturnPage() {
  return (
    <Suspense fallback={null}>
      <SubscribeReturnContent />
    </Suspense>
  );
}
