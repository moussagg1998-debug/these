// Admin — Coupons. Full CRUD for discount codes applied at subscription
// checkout (see lib/server/subscriptions/coupons.ts). THESIS (-95%) is
// seeded via scripts/seed-coupon-thesis.ts — this page is how an admin
// edits or disables it (or creates future promos) without a deploy.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Skeleton } from '@/components/ui/Skeleton';
import { AdminShell } from '@/components/admin/AdminShell';
import { CouponFormModal, type CouponRow } from '@/components/admin/CouponFormModal';

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface CouponsListResponse {
  items: CouponRow[];
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return '—';
  return new Date(expiresAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AdminCouponsPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });
  const {
    data: couponsRes,
    loading,
    refresh,
  } = useApi<CouponsListResponse>('/api/admin/coupons', { skip: !me });

  const [formTarget, setFormTarget] = useState<'new' | CouponRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const items = couponsRes?.items ?? [];

  if (!user) return <LoadingScreen />;
  if (meError) {
    router.replace('/dashboard');
    return null;
  }
  if (!me) return <LoadingScreen />;

  async function toggleActive(row: CouponRow) {
    setBusyId(row.id);
    try {
      await api(`/api/admin/coupons/${row.id}`, {
        method: 'PATCH',
        body: { isActive: !row.isActive },
      });
      toast(row.isActive ? 'Coupon désactivé.' : 'Coupon activé.', 'success');
      void refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      email={me.admin.email}
      role={me.admin.role}
      header={
        <div className="px-4 py-4 sm:px-8 bg-surface border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Administration
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">Coupons</h1>
          </div>
          <button
            type="button"
            onClick={() => setFormTarget('new')}
            className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <Icon i="plus" size={14} />
            Nouveau coupon
          </button>
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-6 px-4 py-6 sm:px-8">
        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[1fr_100px_100px_140px_140px_100px] gap-2 px-5 py-2 border-b border-border bg-background">
                {['Code', 'Réduction', 'Statut', 'Utilisations', 'Expiration', ''].map((h) => (
                  <div
                    key={h}
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </div>
                ))}
              </div>

              {loading && items.length === 0 ? (
                [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_100px_100px_140px_140px_100px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
              ) : items.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  Aucun coupon pour le moment.
                </p>
              ) : (
                items.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-[1fr_100px_100px_140px_140px_100px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                  >
                    <div className="text-sm font-medium text-foreground">{c.code}</div>
                    <div className="text-sm text-foreground">-{c.discountPercent}%</div>
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.isActive
                            ? 'bg-success/15 text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {c.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="text-sm text-foreground">
                      {c.redemptionCount}
                      {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''}
                    </div>
                    <div className="text-sm text-foreground">{formatExpiry(c.expiresAt)}</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormTarget(c)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(c)}
                        disabled={busyId === c.id}
                        className="text-xs font-medium text-muted-foreground hover:underline disabled:opacity-50"
                      >
                        {c.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {formTarget && (
        <CouponFormModal
          {...(formTarget !== 'new' ? { coupon: formTarget } : {})}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            const wasCreate = formTarget === 'new';
            setFormTarget(null);
            toast(wasCreate ? 'Coupon créé.' : 'Coupon mis à jour.', 'success');
            void refresh();
          }}
        />
      )}
    </AdminShell>
  );
}
