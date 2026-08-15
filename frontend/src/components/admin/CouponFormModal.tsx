// Create/edit form for a single coupon — opened from /admin/coupons in
// either mode. Mirrors UpgradeModal.tsx's structure (controlled inputs,
// inline error text, disabled-while-submitting button).
'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

export interface CouponRow {
  id: string;
  code: string;
  discountPercent: number;
  isActive: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  createdAt: string;
}

interface CouponFormModalProps {
  coupon?: CouponRow; // present = edit mode, absent = create mode
  onClose: () => void;
  onSaved: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  COUPON_CODE_TAKEN: 'Ce code est déjà utilisé par un autre coupon.',
  VALIDATION_FAILED: 'Vérifiez les champs du formulaire.',
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function CouponFormModal({ coupon, onClose, onSaved }: CouponFormModalProps) {
  const isEdit = Boolean(coupon);
  const [code, setCode] = useState(coupon?.code ?? '');
  const [discountPercent, setDiscountPercent] = useState(String(coupon?.discountPercent ?? 10));
  const [maxRedemptions, setMaxRedemptions] = useState(
    coupon?.maxRedemptions != null ? String(coupon.maxRedemptions) : '',
  );
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(coupon?.expiresAt ?? null));
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        discountPercent: Number(discountPercent),
        maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      };
      if (isEdit) {
        body.isActive = isActive;
        await api(`/api/admin/coupons/${coupon!.id}`, { method: 'PATCH', body });
      } else {
        body.code = code;
        await api('/api/admin/coupons', { method: 'POST', body });
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ERROR_MESSAGES[err.code] ?? err.message)
          : 'Une erreur est survenue.',
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headings text-base font-semibold text-foreground">
            {isEdit ? `Modifier ${coupon!.code}` : 'Nouveau coupon'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted-foreground"
          >
            <Icon i="x" size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={isEdit}
              required
              minLength={3}
              maxLength={40}
              placeholder="THESIS"
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Réduction (%)
            <input
              type="number"
              min={1}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              required
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Plafond d&apos;utilisations (optionnel)
            <input
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Illimité"
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Expiration (optionnel)
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Actif
            </label>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-sm bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le coupon'}
          </button>
        </form>
      </div>
    </div>
  );
}
