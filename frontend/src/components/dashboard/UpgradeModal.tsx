// "Passer au plan Essentiel" mini-modal — collects the phone/name fields
// Chariow's checkout API requires (see subscriptions/phone.ts) and starts
// the checkout. No new profile fields are persisted; this data only feeds
// the Chariow checkout call.
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

interface UpgradeModalProps {
  defaultFirstName?: string;
  defaultLastName?: string;
  onClose: () => void;
}

export function UpgradeModal({ defaultFirstName, defaultLastName, onClose }: UpgradeModalProps) {
  const [firstName, setFirstName] = useState(defaultFirstName ?? '');
  const [lastName, setLastName] = useState(defaultLastName ?? '');
  const [phoneCountry, setPhoneCountry] = useState('SN');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const res = await api<{ orderId: string; paymentUrl: string }>(
        '/api/subscriptions/checkout',
        {
          method: 'POST',
          body: {
            plan: 'ESSENTIEL',
            firstName,
            lastName,
            phone: `+${dial}${digits}`,
            phoneCountry,
            phoneLocal: digits,
          },
        },
      );
      window.location.href = res.paymentUrl;
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
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-sm bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Redirection vers Chariow…' : 'Payer avec Chariow'}
          </button>
        </form>
      </div>
    </div>
  );
}
