// "Passer au plan Essentiel" mini-modal — collects the phone/name fields
// Chariow's checkout API requires (see subscriptions/phone.ts) and starts
// the checkout. No new profile fields are persisted; this data only feeds
// the Chariow checkout call. An optional coupon code can bypass Chariow
// entirely (see api/subscriptions/checkout/route.ts) — when it does, the
// response carries no paymentUrl and the plan is already active, so this
// modal shows a success state instead of redirecting.
'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

const ERROR_MESSAGES: Record<string, string> = {
  PHONE_INVALID: 'Numéro de téléphone invalide. Vérifiez le pays et le numéro saisis.',
  PAYMENT_PROVIDER_UNCONFIGURED: "Le paiement n'est pas encore configuré. Réessayez plus tard.",
  PAYMENT_PROVIDER_UNAVAILABLE:
    'Le service de paiement est momentanément indisponible. Réessayez dans quelques instants.',
  PAYMENT_IN_FLIGHT: 'Une tentative précédente est en cours. Réessayez dans quelques secondes.',
  PAYMENT_FAILED: 'Le paiement a échoué. Réessayez.',
  VALIDATION_FAILED: 'Vérifiez les champs du formulaire.',
  COUPON_NOT_FOUND: "Ce code promo n'existe pas.",
  COUPON_INACTIVE: "Ce code promo n'est plus actif.",
  COUPON_EXPIRED: 'Ce code promo a expiré.',
  COUPON_MAX_REDEMPTIONS: "Ce code promo a atteint son nombre maximal d'utilisations.",
  COUPON_ALREADY_USED: 'Vous avez déjà utilisé ce code promo.',
  COUPON_REDEMPTION_CONFLICT: 'Une autre tentative est en cours pour ce code promo. Réessayez.',
};

const COUNTRIES = [
  { code: 'SN', label: 'Sénégal (+221)', dial: '221' },
  { code: 'CI', label: "Côte d'Ivoire (+225)", dial: '225' },
  { code: 'CM', label: 'Cameroun (+237)', dial: '237' },
  { code: 'BJ', label: 'Bénin (+229)', dial: '229' },
  { code: 'TG', label: 'Togo (+228)', dial: '228' },
  { code: 'ML', label: 'Mali (+223)', dial: '223' },
  { code: 'BF', label: 'Burkina Faso (+226)', dial: '226' },
];

interface CouponPreview {
  valid: true;
  code: string;
  discountPercent: number;
  originalAmount: number;
  finalAmount: number;
}

interface CouponInvalid {
  valid: false;
  reason: string;
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

interface UpgradeModalProps {
  defaultFirstName?: string;
  defaultLastName?: string;
  onClose: () => void;
  // Fires only when a coupon redemption activates the plan synchronously —
  // distinct from onClose, which also fires on a plain cancel. Callers with
  // local state gated on the old (pre-upgrade) plan — a "limit reached"
  // panel, a cached subscription-status fetch — should refresh it here, not
  // in onClose, so cancelling the modal doesn't touch that state.
  onActivated?: () => void;
}

export function UpgradeModal({
  defaultFirstName,
  defaultLastName,
  onClose,
  onActivated,
}: UpgradeModalProps) {
  const [firstName, setFirstName] = useState(defaultFirstName ?? '');
  const [lastName, setLastName] = useState(defaultLastName ?? '');
  const [phoneCountry, setPhoneCountry] = useState('SN');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState<CouponPreview | null>(null);

  async function checkCoupon() {
    const trimmed = couponCode.trim();
    if (!trimmed) return;
    setCouponChecking(true);
    setCouponError(null);
    setCouponPreview(null);
    try {
      const res = await api<CouponPreview | CouponInvalid>(
        `/api/subscriptions/coupon-preview?code=${encodeURIComponent(trimmed)}`,
      );
      if (res.valid) {
        setCouponPreview(res);
      } else {
        setCouponError(ERROR_MESSAGES[res.reason] ?? 'Ce code promo est invalide.');
      }
    } catch {
      setCouponError('Impossible de vérifier ce code pour le moment.');
    } finally {
      setCouponChecking(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phoneLocal.replace(/\D/g, '').replace(/^0+/, '');
    if (!digits) {
      setError('Saisissez un numéro de téléphone.');
      return;
    }
    setSubmitting(true);
    try {
      const dial = COUNTRIES.find((c) => c.code === phoneCountry)?.dial ?? '';
      const trimmedCoupon = couponCode.trim();
      const res = await api<{
        orderId: string;
        paymentUrl: string | null;
        coupon?: {
          code: string;
          discountPercent: number;
          originalAmount: number;
          finalAmount: number;
        };
      }>('/api/subscriptions/checkout', {
        method: 'POST',
        body: {
          plan: 'ESSENTIEL',
          firstName,
          lastName,
          phone: `+${dial}${digits}`,
          phoneCountry,
          phoneLocal: digits,
          ...(trimmedCoupon ? { couponCode: trimmedCoupon } : {}),
        },
      });
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
        return;
      }
      // Coupon path — plan is already active, nothing to redirect to.
      if (res.coupon) {
        setActivated({
          valid: true,
          code: res.coupon.code,
          discountPercent: res.coupon.discountPercent,
          originalAmount: res.coupon.originalAmount,
          finalAmount: res.coupon.finalAmount,
        });
        onActivated?.();
      }
      setSubmitting(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ERROR_MESSAGES[err.code] ?? err.message)
          : 'Une erreur est survenue.',
      );
      setSubmitting(false);
    }
  }

  if (activated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6 text-center">
          <h3 className="mb-2 font-headings text-base font-semibold text-foreground">
            Abonnement Essentiel activé !
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Le code <strong>{activated.code}</strong> a été appliqué (-{activated.discountPercent}
            %). Votre abonnement est actif dès maintenant.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-sm bg-primary py-2.5 text-sm font-medium text-primary-foreground"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headings text-base font-semibold text-foreground">
            Passer au plan Essentiel
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
          <div className="grid grid-cols-2 gap-3">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prénom"
              required
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom"
              required
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={phoneCountry}
              onChange={(e) => setPhoneCountry(e.target.value)}
              className="rounded-sm border border-border bg-input px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              value={phoneLocal}
              onChange={(e) => setPhoneLocal(e.target.value)}
              placeholder="Numéro local"
              required
              inputMode="numeric"
              className="flex-1 rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value);
                setCouponPreview(null);
                setCouponError(null);
              }}
              placeholder="Code promo (optionnel)"
              className="flex-1 rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => void checkCoupon()}
              disabled={couponChecking || !couponCode.trim()}
              className="rounded-sm border border-border px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              {couponChecking ? '…' : 'Appliquer'}
            </button>
          </div>
          {couponPreview && (
            <div className="rounded-sm border border-border bg-input px-3 py-2 text-xs text-foreground">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prix normal</span>
                <span>{NUMBER_FORMAT.format(couponPreview.originalAmount)} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Réduction (-{couponPreview.discountPercent}%)
                </span>
                <span>
                  -{NUMBER_FORMAT.format(couponPreview.originalAmount - couponPreview.finalAmount)}{' '}
                  FCFA
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
                <span>Total à payer</span>
                <span>{NUMBER_FORMAT.format(couponPreview.finalAmount)} FCFA</span>
              </div>
            </div>
          )}
          {couponError && <p className="text-xs text-danger">{couponError}</p>}

          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-sm bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Traitement…' : 'Payer avec Chariow'}
          </button>
        </form>
      </div>
    </div>
  );
}
