// Admin → Gestion des utilisateurs — user detail modal. Fetches the full
// profile + derived recent-activity signal, and gates each sensitive action
// (suspend/restore/reset-password) on the capability list from GET
// /api/admin/me — every action is server-audited (logAdminAction), this
// component only controls which buttons render.
'use client';

import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { relativeTime } from '@/lib/theses';

interface AdminUserDetail {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  emailVerifiedAt: string | null;
  createdAt: string;
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  institution: { name: string } | null;
  department: string | null;
  academicGrade: string | null;
  specialties: string[];
  bio: string | null;
  lastActivityAt: string | null;
}

interface UserDetailModalProps {
  userId: string;
  can: string[];
  currentAdminId: string;
  onClose: () => void;
  onMutated: () => void;
}

const PROFILE_TYPE_LABELS: Record<string, string> = {
  ENCADRANT: 'Encadrant',
  ETUDIANT: 'Étudiant',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-success/15 text-success',
  SUSPENDED: 'bg-danger/15 text-danger',
};

type ConfirmAction = 'suspend' | 'restore' | 'reset-password';

function displayName(u: Pick<AdminUserDetail, 'name' | 'email'>): string {
  return u.name?.trim() || u.email;
}

export function UserDetailModal({
  userId,
  can,
  currentAdminId,
  onClose,
  onMutated,
}: UserDetailModalProps) {
  const {
    data,
    loading,
    error: fetchError,
    refresh,
  } = useApi<{ user: AdminUserDetail }>(`/api/admin/users/${userId}`);
  const user = data?.user ?? null;

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isSelf = userId === currentAdminId;
  const canSuspend = can.includes('users:status:suspend') && !isSelf;
  const canRestore = can.includes('users:status:restore');
  const canResetPassword = can.includes('users:password_reset');

  function closeConfirm() {
    setConfirmAction(null);
    setReason('');
    setActionError(null);
  }

  async function runAction() {
    if (!confirmAction) return;
    setBusy(true);
    setActionError(null);
    try {
      if (confirmAction === 'suspend') {
        await api(`/api/admin/users/${userId}/status`, {
          method: 'PATCH',
          body: { status: 'SUSPENDED', ...(reason.trim() ? { reason: reason.trim() } : {}) },
        });
      } else if (confirmAction === 'restore') {
        await api(`/api/admin/users/${userId}/status`, {
          method: 'PATCH',
          body: { status: 'ACTIVE' },
        });
      } else {
        await api(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
      }
      closeConfirm();
      await refresh();
      onMutated();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 px-4 py-8 motion-safe:animate-fade-in"
        onClick={() => !confirmAction && onClose()}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-full overflow-y-auto p-6 flex flex-col gap-5 motion-safe:animate-scale-in"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-base font-semibold font-headings text-foreground">
              Détails de l&apos;utilisateur
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="text-muted-foreground transition duration-150 hover:text-foreground motion-safe:active:scale-90"
            >
              <Icon i="x" size={18} />
            </button>
          </div>

          {loading && !user ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-24 w-full" />
            </div>
          ) : fetchError || !user ? (
            <p className="text-sm text-danger">
              Impossible de charger cet utilisateur. {fetchError}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Avatar name={displayName(user)} src={user.avatarUrl} className="h-12 w-12" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {displayName(user)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <span
                  className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_BADGE[user.status]}`}
                >
                  {STATUS_LABELS[user.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Profil</div>
                  <div className="text-foreground">
                    {user.profileType ? PROFILE_TYPE_LABELS[user.profileType] : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Établissement</div>
                  <div className="text-foreground">{user.institution?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Département</div>
                  <div className="text-foreground">{user.department ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Grade académique</div>
                  <div className="text-foreground">{user.academicGrade ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Inscrit le</div>
                  <div className="text-foreground">{relativeTime(user.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dernière activité</div>
                  <div className="text-foreground">
                    {user.lastActivityAt
                      ? relativeTime(user.lastActivityAt)
                      : 'Aucune activité enregistrée'}
                  </div>
                </div>
              </div>

              {user.specialties.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Spécialités</div>
                  <div className="flex flex-wrap gap-1.5">
                    {user.specialties.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {user.bio && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bio</div>
                  <p className="text-sm text-foreground leading-relaxed">{user.bio}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                {user.status === 'ACTIVE' && canSuspend && (
                  <button
                    type="button"
                    onClick={() => setConfirmAction('suspend')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition duration-150 hover:bg-danger/10"
                  >
                    <Icon i="alert-circle" size={14} />
                    Suspendre
                  </button>
                )}
                {user.status === 'SUSPENDED' && canRestore && (
                  <button
                    type="button"
                    onClick={() => setConfirmAction('restore')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-success/40 px-3 py-1.5 text-xs font-medium text-success transition duration-150 hover:bg-success/10"
                  >
                    <Icon i="check-circle" size={14} />
                    Réactiver
                  </button>
                )}
                {canResetPassword && (
                  <button
                    type="button"
                    onClick={() => setConfirmAction('reset-password')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition duration-150 hover:bg-input"
                  >
                    <Icon i="mail" size={14} />
                    Réinitialiser le mot de passe
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {confirmAction === 'suspend' && (
        <ConfirmModal
          title="Suspendre ce compte ?"
          description={`${displayName(user ?? { name: null, email: '' })} ne pourra plus se connecter tant que le compte n'est pas réactivé. Cette action est enregistrée dans le journal d'audit.`}
          confirmLabel="Suspendre"
          confirmBusyLabel="Suspension…"
          tone="danger"
          busy={busy}
          error={actionError}
          onConfirm={() => void runAction()}
          onCancel={closeConfirm}
        >
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif (facultatif)"
            maxLength={500}
            rows={2}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </ConfirmModal>
      )}

      {confirmAction === 'restore' && (
        <ConfirmModal
          title="Réactiver ce compte ?"
          description={`${displayName(user ?? { name: null, email: '' })} pourra de nouveau se connecter. Cette action est enregistrée dans le journal d'audit.`}
          confirmLabel="Réactiver"
          confirmBusyLabel="Réactivation…"
          tone="primary"
          busy={busy}
          error={actionError}
          onConfirm={() => void runAction()}
          onCancel={closeConfirm}
        />
      )}

      {confirmAction === 'reset-password' && (
        <ConfirmModal
          title="Réinitialiser le mot de passe ?"
          description={`Un email de réinitialisation sera envoyé à ${user?.email ?? ''}. Cette action est enregistrée dans le journal d'audit.`}
          confirmLabel="Envoyer l'email"
          confirmBusyLabel="Envoi…"
          tone="primary"
          busy={busy}
          error={actionError}
          onConfirm={() => void runAction()}
          onCancel={closeConfirm}
        />
      )}
    </>
  );
}
