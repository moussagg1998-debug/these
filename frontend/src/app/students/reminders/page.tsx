// Rappels groupés — Banani `new_screen8.jsx`. Entry point: the "Envoyer des
// rappels groupés" button on /dashboard (previously disabled).
//
// ENCADRANT-only — no student-side equivalent exists in Banani for this
// screen, so unlike /documents, /comments, /deadlines (which branch to a
// Student*Content component) a non-ENCADRANT visitor is simply redirected
// to /dashboard, same treatment as the null-profileType redirect below.
//
// Every send always creates a real Message row (visible in the student's
// /messages thread) regardless of channel toggles — Email/In-app only
// control whether an email and/or Notification additionally fire. SMS and
// "Planifier l'envoi" are dropped entirely from this build (Banani shows
// them, but neither has backing infrastructure in this starter) — a
// user-confirmed departure from the mock, see
// .planning/banani/phase-16-rappels-groupes.md.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { UpgradeModal } from '@/components/dashboard/UpgradeModal';
import {
  ReminderRecipientRow,
  ReminderRecipientRowSkeleton,
} from '@/components/dashboard/ReminderRecipientRow';
import { urgencyFromDueDate, type ThesisListItem } from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface ThesesResponse {
  items: ThesisListItem[];
  total: number;
}

interface SubscriptionStatus {
  plan: 'FREE' | 'ESSENTIEL';
  planExpiresAt: string | null;
}

interface ReminderTemplate {
  id: 'standard' | 'urgent' | 'encouragement' | 'custom';
  label: string;
  subject: string;
  body: string;
}

const TEMPLATES: ReminderTemplate[] = [
  {
    id: 'standard',
    label: 'Standard',
    subject: 'Rappel — Veuillez soumettre votre prochain chapitre',
    body: "Bonjour {{prénom}},\n\nJe vous contacte pour vous rappeler que je n'ai pas encore reçu votre dernière soumission. Merci de bien vouloir déposer votre travail dans les plus brefs délais sur ThèseFacile.\n\nN'hésitez pas à me contacter si vous rencontrez des difficultés.\n\nCordialement,",
  },
  {
    id: 'urgent',
    label: 'Urgent',
    subject: 'Rappel urgent — Soumission en retard',
    body: 'Bonjour {{prénom}},\n\nVotre dernière soumission accuse un retard important. Merci de déposer votre travail dans les plus brefs délais afin de ne pas compromettre le calendrier de votre thèse.\n\nContactez-moi rapidement si vous rencontrez une difficulté.\n\nCordialement,',
  },
  {
    id: 'encouragement',
    label: 'Encouragement',
    subject: 'Continuez sur cette lancée !',
    body: "Bonjour {{prénom}},\n\nJe voulais prendre un instant pour vous encourager dans la poursuite de votre travail. N'hésitez pas à me solliciter si vous avez besoin d'un retour ou d'un conseil.\n\nBon courage pour la suite !\n\nCordialement,",
  },
  { id: 'custom', label: 'Personnalisé', subject: '', body: '' },
];

const ERROR_MESSAGES: Record<string, string> = {
  NO_VALID_RECIPIENTS: 'Aucun des étudiants sélectionnés ne vous est assigné.',
  VALIDATION_FAILED: 'Vérifiez les champs du formulaire.',
  PROFILE_TYPE_FORBIDDEN: 'Réservé aux encadrants.',
  PLAN_UPGRADE_REQUIRED: 'Cette fonctionnalité nécessite le plan Essentiel.',
};

export default function GroupRemindersPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const {
    data: theses,
    loading: thesesLoading,
    error: thesesError,
  } = useApi<ThesesResponse>('/api/theses?limit=50', {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });
  const { data: subStatus, loading: subLoading } = useApi<SubscriptionStatus>(
    '/api/subscriptions/status',
    { skip: !user },
  );

  const items = useMemo(() => theses?.items ?? [], [theses]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [templateId, setTemplateId] = useState<ReminderTemplate['id']>('standard');
  const [subject, setSubject] = useState(TEMPLATES[0]!.subject);
  const [body, setBody] = useState(TEMPLATES[0]!.body);
  const [emailChannel, setEmailChannel] = useState(true);
  const [inAppChannel, setInAppChannel] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Default: every student pre-selected — the encadrant opts out rather
  // than opts in (user-confirmed default). Only runs once, so a background
  // refetch of /api/theses doesn't fight the encadrant's manual toggles.
  useEffect(() => {
    if (!initialized && items.length > 0) {
      setSelected(new Set(items.map((t) => t.id)));
      setInitialized(true);
    }
  }, [items, initialized]);

  if (!user || profileLoading || !profile || subLoading || !subStatus) {
    return <LoadingScreen />;
  }

  if (profile.profileType !== 'ENCADRANT') {
    router.replace('/dashboard');
    return null;
  }

  const name = profile.name || user.email.split('@')[0] || user.email;

  const isEssentiel =
    subStatus.plan === 'ESSENTIEL' &&
    (!subStatus.planExpiresAt || new Date(subStatus.planExpiresAt) > new Date());

  if (!isEssentiel) {
    const [firstNamePart, ...restNameParts] = name.trim().split(/\s+/);
    const upgradeFirstName = firstNamePart ?? '';
    const upgradeLastName = restNameParts.join(' ');
    return (
      <DashboardShell name={name}>
        <div className="flex flex-col min-h-full">
          <div className="flex items-center gap-3 px-4 py-4 sm:px-8 bg-surface border-b border-border">
            <Link
              href="/dashboard"
              aria-label="Retour au tableau de bord"
              className="w-8 h-8 shrink-0 rounded-sm border border-border bg-background flex items-center justify-center text-muted-foreground transition-colors duration-150 hover:bg-input"
            >
              <Icon i="arrow-left" size={15} />
            </Link>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
                Mes étudiants
              </div>
              <h1 className="text-lg sm:text-xl font-semibold font-headings text-foreground truncate">
                Envoyer des rappels groupés
              </h1>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Icon i="lock" size={22} className="text-secondary-foreground" />
            </div>
            <h2 className="font-headings text-lg font-semibold text-foreground">
              Cette fonctionnalité nécessite le plan Essentiel
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Les rappels groupés permettent de contacter tous vos étudiants en un seul envoi.
              Passez au plan Essentiel pour y accéder.
            </p>
            <button
              type="button"
              onClick={() => setUpgradeModalOpen(true)}
              className="mt-2 rounded-sm bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Voir l&apos;offre Essentiel
            </button>
          </div>
        </div>

        {upgradeModalOpen && (
          <UpgradeModal
            defaultFirstName={upgradeFirstName}
            defaultLastName={upgradeLastName}
            onClose={() => setUpgradeModalOpen(false)}
          />
        )}
      </DashboardShell>
    );
  }

  function toggleOne(thesisId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(thesisId)) next.delete(thesisId);
      else next.add(thesisId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(items.map((t) => t.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function applyTemplate(tpl: ReminderTemplate) {
    setTemplateId(tpl.id);
    setSubject(tpl.subject);
    setBody(tpl.body);
  }

  const selectedTheses = items.filter((t) => selected.has(t.id));
  const highUrgencyCount = selectedTheses.filter(
    (t) => t.deadlines[0] && urgencyFromDueDate(t.deadlines[0].dueAt) === 'high',
  ).length;

  const channelLabel =
    emailChannel && inAppChannel
      ? 'Email + App'
      : emailChannel
        ? 'Email'
        : inAppChannel
          ? 'App'
          : 'Aucun';

  const canSubmit =
    selected.size > 0 &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    (emailChannel || inAppChannel) &&
    !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api<{ sent: number }>('/api/reminders', {
        method: 'POST',
        body: {
          thesisIds: Array.from(selected),
          subject: subject.trim(),
          body: body.trim(),
          channels: { email: emailChannel, inApp: inAppChannel },
        },
      });
      toast(
        `${res.sent} rappel${res.sent > 1 ? 's' : ''} envoyé${res.sent > 1 ? 's' : ''}`,
        'success',
      );
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError('Une erreur est survenue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell name={name}>
      <div className="flex flex-col min-h-full">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <Link
            href="/dashboard"
            aria-label="Retour au tableau de bord"
            className="w-8 h-8 shrink-0 rounded-sm border border-border bg-background flex items-center justify-center text-muted-foreground transition-colors duration-150 hover:bg-input"
          >
            <Icon i="arrow-left" size={15} />
          </Link>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Mes étudiants
            </div>
            <h1 className="text-lg sm:text-xl font-semibold font-headings text-foreground truncate">
              Envoyer des rappels groupés
            </h1>
          </div>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row gap-0 min-w-0">
          {/* Left — recipients + message */}
          <div className="flex-1 flex flex-col px-4 py-6 sm:px-8 gap-6 min-w-0">
            {/* Step 1 — Recipients */}
            <div>
              <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-5 h-5 bg-primary text-primary-foreground text-xs font-semibold rounded-full flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">Destinataires</h2>
                  <span className="text-xs text-muted-foreground">
                    {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs text-secondary-foreground transition-colors duration-150 hover:text-secondary-foreground/70"
                  >
                    Tout sélectionner
                  </button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button
                    type="button"
                    onClick={selectNone}
                    className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    Désélectionner
                  </button>
                </div>
              </div>

              {thesesLoading && !theses ? (
                <div className="border border-border rounded-md overflow-hidden">
                  <ReminderRecipientRowSkeleton />
                  <ReminderRecipientRowSkeleton />
                  <ReminderRecipientRowSkeleton />
                </div>
              ) : thesesError ? (
                <p className="text-sm text-danger">
                  Impossible de charger vos étudiants. Réessayez plus tard.
                </p>
              ) : items.length === 0 ? (
                <div className="border border-dashed border-border rounded-md p-8 text-center motion-safe:animate-fade-in">
                  <p className="text-sm text-muted-foreground">
                    Aucun étudiant à contacter pour l&apos;instant.
                  </p>
                  <Link
                    href="/students"
                    className="text-sm text-primary font-medium mt-2 inline-block"
                  >
                    Voir mes étudiants
                  </Link>
                </div>
              ) : (
                <div className="border border-border rounded-md max-h-64 overflow-y-auto overflow-x-hidden">
                  {items.map((thesis) => (
                    <ReminderRecipientRow
                      key={thesis.id}
                      thesis={thesis}
                      selected={selected.has(thesis.id)}
                      onToggle={toggleOne}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Step 2 — Message */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 bg-primary text-primary-foreground text-xs font-semibold rounded-full flex items-center justify-center shrink-0">
                  2
                </span>
                <h2 className="text-sm font-semibold text-foreground">Message du rappel</h2>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-sm border transition-colors duration-150 ${
                      templateId === tpl.id
                        ? 'border-primary bg-secondary text-secondary-foreground'
                        : 'border-border text-muted-foreground hover:bg-input'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 mb-3">
                <label
                  htmlFor="reminder-subject"
                  className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
                >
                  Objet
                </label>
                <input
                  id="reminder-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none focus:border-primary transition-colors duration-150"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="reminder-body"
                  className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
                >
                  Corps du message
                </label>
                <textarea
                  id="reminder-body"
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={5000}
                  className="border border-border rounded-md px-4 py-3 text-sm text-foreground bg-input leading-relaxed min-h-36 outline-none focus:border-primary transition-colors duration-150 resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  {'{{prénom}}'} sera remplacé automatiquement par le prénom de chaque étudiant.
                </p>
              </div>
            </div>

            {/* Step 3 — Channel */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 bg-primary text-primary-foreground text-xs font-semibold rounded-full flex items-center justify-center shrink-0">
                  {Number(emailChannel) + Number(inAppChannel)}
                </span>
                <h2 className="text-sm font-semibold text-foreground">Canal d&apos;envoi</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setEmailChannel((v) => !v)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-sm border text-sm font-medium transition-colors duration-150 ${
                    emailChannel
                      ? 'border-primary bg-secondary text-secondary-foreground'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      emailChannel ? 'border-primary' : 'border-border'
                    }`}
                  >
                    {emailChannel && <span className="w-2 h-2 bg-primary rounded-full" />}
                  </span>
                  <Icon i="mail" size={13} />
                  Email institutionnel
                </button>
                <button
                  type="button"
                  onClick={() => setInAppChannel((v) => !v)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-sm border text-sm font-medium transition-colors duration-150 ${
                    inAppChannel
                      ? 'border-primary bg-secondary text-secondary-foreground'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      inAppChannel ? 'border-primary' : 'border-border'
                    }`}
                  >
                    {inAppChannel && <span className="w-2 h-2 bg-primary rounded-full" />}
                  </span>
                  <Icon i="bell" size={13} />
                  Notification in-app
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Un message est toujours ajouté à votre conversation avec chaque étudiant, quel que
                soit le canal choisi ci-dessus.
              </p>
            </div>
          </div>

          {/* Right panel — summary */}
          <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-border flex flex-col bg-surface px-5 py-6 gap-6">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
                Récapitulatif
              </h3>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Destinataires</span>
                  <span className="font-semibold text-foreground">{selected.size}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Canaux</span>
                  <span className="font-semibold text-foreground">{channelLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Modèle</span>
                  <span className="font-semibold text-foreground">
                    {TEMPLATES.find((t) => t.id === templateId)?.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Envoi</span>
                  <span className="font-semibold text-foreground">Immédiat</span>
                </div>
              </div>
            </div>

            {highUrgencyCount > 0 && (
              <div className="flex items-start gap-2.5 p-3 bg-background border border-border rounded-md">
                <Icon i="info" size={13} className="text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {highUrgencyCount} étudiant{highUrgencyCount > 1 ? 's' : ''} en urgence haute{' '}
                  {highUrgencyCount > 1 ? 'sont inclus' : 'est inclus'} dans cet envoi.
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 mt-auto">
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                className="w-full bg-primary text-primary-foreground text-sm font-semibold py-3 rounded-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 motion-safe:enabled:active:scale-[0.98]"
              >
                <Icon i="send" size={14} />
                {submitting ? 'Envoi…' : 'Envoyer les rappels'}
              </button>
              <Link
                href="/dashboard"
                className="w-full text-center text-sm text-muted-foreground py-2"
              >
                Annuler
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
