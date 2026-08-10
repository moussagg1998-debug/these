// /settings — account-level controls.
//
// Branches on profileType (see .planning/banani/phase-6-encadrant-settings.md):
//   - ENCADRANT → the Banani-sourced "Paramètres — Compte & Préférences"
//     screen (EncadrantSettingsContent below), inside DashboardShell.
//   - anything else (ETUDIANT, still onboarding, loading) → the pre-existing
//     generic content below, UNCHANGED. Banani ships a separate student
//     settings screen that isn't built yet — gating this whole route to
//     ENCADRANT and redirecting everyone else would regress real, working
//     password/Google-linking functionality for ETUDIANT accounts today.
//
// The generic flows (both still used verbatim by the non-ENCADRANT branch,
// and reused by EncadrantSettingsContent via PasswordSettingsModal):
//   1. Set / change password
//      - If the account was created via OAuth (hasPassword=false), the
//        "Set password" form calls POST /api/auth/set-password — no current
//        password required, because there isn't one.
//      - Otherwise the "Change password" form calls PUT /api/auth/change-password
//        with currentPassword + newPassword.
//   2. Link a provider (Google)
//      - When Google is not already linked, the button kicks the user to
//        GET /api/auth/oauth/google/start?next=/settings, which goes through
//        the normal OAuth dance and lands back on /settings linked.
//      - When already linked, we just show a "linked" pill — no unlink action
//        yet (would need a /api/auth/oauth/google/unlink endpoint with a
//        guard refusing to leave the user without any sign-in method).
'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { useAuth, useUser, type User } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { useSlidingIndicator } from '@/lib/useSlidingIndicator';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { SettingSection, type SettingItem } from '@/components/dashboard/SettingSection';
import { PasswordSettingsModal } from '@/components/dashboard/PasswordSettingsModal';
import { ProfileTab } from '@/components/dashboard/ProfileTab';
import { StudentShell } from '@/components/student/StudentShell';
import {
  DATE_FORMAT_OPTIONS,
  LOCALE_OPTIONS,
  TIMEZONE_OPTIONS,
  setDatePreferences,
} from '@/lib/datePreferences';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  department: string | null;
  academicGrade: string | null;
  specialties: string[];
  bio: string | null;
  institution: { id: string; name: string } | null;
  locale: string;
  timezone: string;
  dateFormat: string;
}

type ChannelPrefs = { email?: boolean; inApp?: boolean };
type NotificationPrefs = Record<string, ChannelPrefs>;

interface NotificationPrefsResponse {
  prefs: NotificationPrefs;
}

// Client-side mirror of the server's isChannelEnabled (prefs-merge.ts is
// `server-only` and can't be imported into a client component). Same D-10
// opt-out semantics: missing event/channel ⇒ enabled.
function isEnabled(
  prefs: NotificationPrefs | undefined,
  eventType: string,
  channel: 'email' | 'inApp',
): boolean {
  const value = prefs?.[eventType]?.[channel];
  return value !== false;
}

const AVATAR_ERROR_MESSAGES: Record<string, string> = {
  FILE_TOO_LARGE: 'Fichier trop volumineux.',
  INVALID_MIME: 'Format non supporté — utilisez une image JPEG, PNG ou WebP.',
  MAGIC_BYTE_MISMATCH: 'Le fichier ne correspond pas au format déclaré.',
  STORAGE_NOT_CONFIGURED: "Le stockage d'images n'est pas configuré.",
};

function EncadrantSettingsContent({
  name,
  user,
  profile,
  refreshProfile,
}: {
  name: string;
  user: User;
  profile: ProfileResponse;
  refreshProfile: () => Promise<void>;
}) {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [overrides, setOverrides] = useState<NotificationPrefs>({});
  const [activeTab, setActiveTab] = useState<'profil' | 'parametres'>('profil');
  const { containerRef, registerItem, style, ready } = useSlidingIndicator(activeTab);
  const [locale, setLocale] = useState(profile.locale);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [dateFormat, setDateFormat] = useState(profile.dateFormat);

  useEffect(() => {
    setLocale(profile.locale);
    setTimezone(profile.timezone);
    setDateFormat(profile.dateFormat);
    setDatePreferences({ timezone: profile.timezone, dateFormat: profile.dateFormat });
  }, [profile]);

  const { data: prefsRes, refresh: refreshPrefs } = useApi<NotificationPrefsResponse>(
    '/api/notifications/prefs',
  );

  const effectivePrefs = useMemo(() => {
    const base = prefsRes?.prefs ?? {};
    const merged: NotificationPrefs = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(overrides)])) {
      merged[key] = { ...base[key], ...overrides[key] };
    }
    return merged;
  }, [prefsRes, overrides]);

  async function patchPrefs(patch: NotificationPrefs) {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        next[k] = { ...next[k], ...v };
      }
      return next;
    });
    try {
      await api('/api/notifications/prefs', { method: 'PATCH', body: { prefs: patch } });
    } catch {
      toast('Impossible de mettre à jour la préférence.', 'error');
      void refreshPrefs();
    }
  }

  // Settings → "Général". Applies immediately (setDatePreferences) so
  // formatDate() reflects the change on this page without a reload, then
  // persists it — optimistic update with rollback on failure, same pattern
  // as patchPrefs above.
  async function patchGeneral(
    field: 'locale' | 'timezone' | 'dateFormat',
    value: string,
    rollback: string,
    setLocal: (v: string) => void,
  ) {
    setLocal(value);
    if (field === 'timezone' || field === 'dateFormat') {
      setDatePreferences({ [field]: value });
    }
    try {
      await api('/api/profile', { method: 'PATCH', body: { [field]: value } });
    } catch {
      toast('Impossible de mettre à jour la préférence.', 'error');
      setLocal(rollback);
      if (field === 'timezone' || field === 'dateFormat') {
        setDatePreferences({ [field]: rollback });
      }
    }
  }

  const documentSubmittedInApp = isEnabled(effectivePrefs, 'DOCUMENT_SUBMITTED', 'inApp');
  const commentAddedInApp = isEnabled(effectivePrefs, 'COMMENT_ADDED', 'inApp');
  const deadlineReminderInApp = isEnabled(effectivePrefs, 'DEADLINE_REMINDER', 'inApp');
  const emailChannel = isEnabled(effectivePrefs, 'DOCUMENT_SUBMITTED', 'email');

  const googleLinked = user.linkedProviders.includes('google');
  const memberSince = new Date(user.createdAt).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  function onPasswordSuccess(message: string) {
    setPasswordModalOpen(false);
    void refresh();
    toast(message, 'success');
  }

  async function onAvatarSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarUploading(true);
    try {
      const uploaded = await uploadFile(file);
      await api('/api/profile', { method: 'PATCH', body: { avatarUrl: uploaded.url } });
      await Promise.all([refreshProfile(), refresh()]);
      toast('Photo de profil mise à jour.', 'success');
    } catch (err) {
      toast(
        err instanceof ApiError
          ? (AVATAR_ERROR_MESSAGES[err.code] ?? err.message)
          : 'Une erreur est survenue.',
        'error',
      );
    } finally {
      setAvatarUploading(false);
    }
  }

  const generalItems: SettingItem[] = [
    {
      label: 'Langue',
      description: "Langue de l'interface — seul le français est disponible pour l'instant",
      type: 'select',
      value: locale,
      options: LOCALE_OPTIONS,
      onChange: (v) => void patchGeneral('locale', v, locale, setLocale),
    },
    {
      label: 'Fuseau horaire',
      description: 'Pour les rappels et notifications',
      type: 'select',
      value: timezone,
      options: TIMEZONE_OPTIONS,
      onChange: (v) => void patchGeneral('timezone', v, timezone, setTimezone),
    },
    {
      label: 'Format de date',
      description: 'Date et heure par défaut',
      type: 'select',
      value: dateFormat,
      options: DATE_FORMAT_OPTIONS,
      onChange: (v) => void patchGeneral('dateFormat', v, dateFormat, setDateFormat),
    },
  ];

  const notificationItems: SettingItem[] = [
    {
      label: 'Nouvelles soumissions',
      description: 'Recevoir une alerte quand un étudiant soumet',
      type: 'toggle',
      checked: documentSubmittedInApp,
      onToggle: () => void patchPrefs({ DOCUMENT_SUBMITTED: { inApp: !documentSubmittedInApp } }),
    },
    {
      label: "Rappels d'échéances",
      description: '3 jours avant une échéance critique',
      type: 'toggle',
      checked: deadlineReminderInApp,
      onToggle: () => void patchPrefs({ DEADLINE_REMINDER: { inApp: !deadlineReminderInApp } }),
    },
    {
      label: 'Réponses aux commentaires',
      description: 'Quand un étudiant répond à votre feedback',
      type: 'toggle',
      checked: commentAddedInApp,
      onToggle: () => void patchPrefs({ COMMENT_ADDED: { inApp: !commentAddedInApp } }),
    },
    {
      label: 'Notifications par email',
      description: 'En plus des notifications internes',
      type: 'toggle',
      checked: emailChannel,
      onToggle: () =>
        void patchPrefs({
          DOCUMENT_SUBMITTED: { email: !emailChannel },
          COMMENT_ADDED: { email: !emailChannel },
          DEADLINE_REMINDER: { email: !emailChannel },
        }),
    },
  ];

  const securityItems: SettingItem[] = [
    {
      label: 'Mot de passe',
      description: 'Modifier votre mot de passe',
      type: 'button',
      action: user.hasPassword ? 'Changer' : 'Définir',
      onAction: () => setPasswordModalOpen(true),
    },
    {
      label: 'Authentification à deux facteurs',
      description: 'Renforcer la sécurité de votre compte',
      type: 'button',
      action: 'Activer',
      disabled: true,
      disabledTitle: 'Bientôt disponible',
    },
    {
      label: 'Sessions actives',
      description: 'Voir et terminer les sessions',
      type: 'button',
      action: 'Gérer',
      disabled: true,
      disabledTitle: 'Bientôt disponible',
    },
    googleLinked
      ? {
          label: 'Compte Google',
          description: 'Connexion en un clic activée',
          type: 'text',
          value: 'Lié',
        }
      : {
          label: 'Compte Google',
          description: 'Lier votre compte Google',
          type: 'button',
          action: 'Lier',
          onAction: () => {
            window.location.href = '/api/auth/oauth/google/start?next=/settings';
          },
        },
  ];

  const dataItems: SettingItem[] = [
    {
      label: 'Exporter mes données',
      description: 'Télécharger un backup de vos données',
      type: 'button',
      action: 'Exporter',
      disabled: true,
      disabledTitle: 'Bientôt disponible',
    },
    {
      label: 'Intégration Google Drive',
      description: 'Synchroniser automatiquement les documents',
      type: 'toggle',
      disabled: true,
      disabledTitle: 'Bientôt disponible',
    },
    {
      label: 'Intégration Dropbox',
      description: 'Ajouter Dropbox comme stockage',
      type: 'button',
      action: 'Connecter',
      disabled: true,
      disabledTitle: 'Bientôt disponible',
    },
  ];

  const accountItems: SettingItem[] = [
    {
      label: 'Email principal',
      description: 'Adresse associée à votre compte',
      type: 'text',
      value: user.email,
    },
    {
      label: 'Supprimer le compte',
      description: 'Cette action est irréversible',
      type: 'button',
      action: 'Supprimer',
      disabled: true,
      disabledTitle: 'Bientôt disponible',
    },
  ];

  return (
    <DashboardShell
      name={name}
      header={<DashboardHeader eyebrow="Compte" title="Paramètres & Préférences" />}
    >
      <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8">
        <div className="flex flex-col sm:flex-row items-start gap-6 pb-8 border-b border-border mb-8">
          <div className="relative">
            <Avatar name={name} src={profile.avatarUrl} className="h-24 w-24 text-2xl" />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void onAvatarSelected(e)}
            />
            <button
              type="button"
              disabled={avatarUploading}
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background transition duration-150 hover:opacity-90 disabled:opacity-50 motion-safe:active:scale-90"
            >
              <Icon
                i={avatarUploading ? 'loader' : 'camera'}
                size={12}
                className={avatarUploading ? 'animate-spin' : undefined}
              />
            </button>
          </div>
          <div>
            <h2 className="text-xl font-semibold font-headings text-foreground">{name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {profile.emailVerified && (
                <div className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-sm font-medium">
                  Encadrant vérifié
                </div>
              )}
              {profile.institution && (
                <div className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-sm font-medium">
                  {profile.institution.name}
                </div>
              )}
              <div className="text-xs px-2 py-1 bg-input text-muted-foreground rounded-sm">
                Membre depuis {memberSince}
              </div>
            </div>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative flex items-center gap-1 border-b border-border mb-8"
        >
          <div
            aria-hidden
            className={`absolute bottom-0 h-0.5 rounded-full bg-primary transition-[left,width] duration-250 ease-out ${ready ? 'opacity-100' : 'opacity-0'}`}
            style={{ left: style.left, width: style.width }}
          />
          <button
            type="button"
            ref={registerItem('profil')}
            onClick={() => setActiveTab('profil')}
            className={`relative px-4 py-2.5 text-sm font-medium border-b-2 border-transparent -mb-px transition-colors duration-150 ${
              activeTab === 'profil'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Profil
          </button>
          <button
            type="button"
            ref={registerItem('parametres')}
            onClick={() => setActiveTab('parametres')}
            className={`relative px-4 py-2.5 text-sm font-medium border-b-2 border-transparent -mb-px transition-colors duration-150 ${
              activeTab === 'parametres'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Paramètres
          </button>
        </div>

        {activeTab === 'profil' ? (
          <ProfileTab profile={profile} onSaved={() => void refreshProfile()} />
        ) : (
          <div className="space-y-6">
            <SettingSection title="Général" icon="sliders" items={generalItems} />
            <SettingSection title="Notifications" icon="bell" items={notificationItems} />
            <SettingSection title="Confidentialité & Sécurité" icon="lock" items={securityItems} />
            <SettingSection
              title="Données & Intégrations"
              icon="database"
              items={dataItems}
              defaultOpen={false}
            />
            <SettingSection title="Compte" icon="user" items={accountItems} defaultOpen={false} />
          </div>
        )}
      </div>

      {passwordModalOpen && (
        <PasswordSettingsModal
          hasPassword={user.hasPassword}
          onClose={() => setPasswordModalOpen(false)}
          onSuccess={onPasswordSuccess}
        />
      )}
    </DashboardShell>
  );
}

export default function SettingsPage() {
  const user = useUser();
  const { refresh } = useAuth();
  const { toast } = useToast();

  // Password form state — fields used by either branch.
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const {
    data: profile,
    loading: profileLoading,
    refresh: refreshProfile,
  } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });

  if (!user || profileLoading) {
    return <LoadingScreen />;
  }

  if (profile?.profileType === 'ENCADRANT') {
    const name = profile.name || user.email.split('@')[0] || user.email;
    return (
      <EncadrantSettingsContent
        name={name}
        user={user}
        profile={profile}
        refreshProfile={refreshProfile}
      />
    );
  }

  const hasPassword = user.hasPassword;
  const googleLinked = user.linkedProviders.includes('google');
  const name = profile?.name || user.email.split('@')[0] || user.email;

  async function onAvatarSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarUploading(true);
    try {
      const uploaded = await uploadFile(file);
      await api('/api/profile', { method: 'PATCH', body: { avatarUrl: uploaded.url } });
      await Promise.all([refreshProfile(), refresh()]);
      toast('Photo de profil mise à jour.', 'success');
    } catch (err) {
      toast(
        err instanceof ApiError
          ? (AVATAR_ERROR_MESSAGES[err.code] ?? err.message)
          : 'Une erreur est survenue.',
        'error',
      );
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length === 0) {
      setError('Saisis un nouveau mot de passe.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setSubmitting(true);
    try {
      if (hasPassword) {
        await api('/api/auth/change-password', {
          method: 'PUT',
          body: { currentPassword, newPassword },
        });
        toast('Mot de passe mis à jour.', 'success');
      } else {
        await api('/api/auth/set-password', {
          method: 'POST',
          body: { newPassword },
        });
        toast('Mot de passe défini. Tu peux maintenant te connecter par email.', 'success');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const map: Record<string, string> = {
          INVALID_CREDENTIALS: 'Mot de passe actuel incorrect.',
          PASSWORD_BANNED: 'Ce mot de passe est trop courant.',
          PASSWORD_TOO_SHORT: err.message || 'Mot de passe trop court.',
          PASSWORD_PWNED: 'Ce mot de passe a fuité — choisis-en un autre.',
          PASSWORD_ALREADY_SET:
            'Un mot de passe est déjà défini. Utilise « changer le mot de passe ».',
          VALIDATION_FAILED: 'Champs invalides.',
        };
        setError(map[err.code] ?? err.message);
      } else {
        setError('Erreur réseau. Réessaie.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StudentShell name={name} active="settings">
      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-12">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-sm text-muted-foreground">Connecté en tant que {user.email}</p>
        </header>

        {/* ── Avatar section ───────────────────────────────────────────── */}
        <section className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
          <div className="relative shrink-0">
            <Avatar name={name} src={profile?.avatarUrl} className="h-16 w-16 text-xl" />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void onAvatarSelected(e)}
            />
            <button
              type="button"
              disabled={avatarUploading}
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background transition duration-150 hover:opacity-90 disabled:opacity-50 motion-safe:active:scale-90"
            >
              <Icon
                i={avatarUploading ? 'loader' : 'camera'}
                size={11}
                className={avatarUploading ? 'animate-spin' : undefined}
              />
            </button>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">Photo de profil</span>
            <span className="text-xs text-muted-foreground">JPEG, PNG ou WebP.</span>
          </div>
        </section>

        {/* ── Password section ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold text-foreground">
            {hasPassword ? 'Changer le mot de passe' : 'Définir un mot de passe'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {hasPassword
              ? 'Tu peux modifier ton mot de passe ici. Les autres sessions seront déconnectées.'
              : 'Tu t’es connecté via Google. Définis un mot de passe pour pouvoir aussi te connecter par email.'}
          </p>
          <form onSubmit={onSubmitPassword} className="mt-2 flex flex-col gap-4">
            {hasPassword && (
              <label className="flex flex-col gap-1 text-sm text-foreground">
                Mot de passe actuel
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="rounded-md border border-border bg-input px-3 py-2 text-foreground outline-none focus:border-primary"
                />
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm text-foreground">
              Nouveau mot de passe
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-md border border-border bg-input px-3 py-2 text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-foreground">
              Confirmer le nouveau mot de passe
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-md border border-border bg-input px-3 py-2 text-foreground outline-none focus:border-primary"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 transition duration-150 motion-safe:active:scale-[0.98]"
            >
              {submitting
                ? 'Enregistrement…'
                : hasPassword
                  ? 'Changer le mot de passe'
                  : 'Définir le mot de passe'}
            </button>
          </form>
        </section>

        {/* ── Linked providers section ────────────────────────────────── */}
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold text-foreground">Comptes liés</h2>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Google</span>
              <span className="text-xs text-muted-foreground">
                {googleLinked
                  ? 'Tu peux te connecter via Google.'
                  : 'Lie ton compte Google pour te connecter en un clic.'}
              </span>
            </div>
            {googleLinked ? (
              <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
                Lié
              </span>
            ) : (
              <a
                href="/api/auth/oauth/google/start?next=/settings"
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-input"
              >
                Lier Google
              </a>
            )}
          </div>
        </section>

        <Link href="/dashboard" className="text-center text-sm text-muted-foreground underline">
          Retour au dashboard
        </Link>
      </main>
    </StudentShell>
  );
}
