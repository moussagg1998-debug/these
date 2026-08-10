// Admin — Gestion des utilisateurs. Search + filter (Étudiant/Encadrant,
// statut) over the real user base, cursor-paginated. Always scoped to
// role=USER (regular platform accounts) — managing fellow ADMIN/SUPERADMIN
// accounts wasn't requested and isn't this page's job.
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi, invalidateCachePrefix } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Skeleton } from '@/components/ui/Skeleton';
import { AdminShell } from '@/components/admin/AdminShell';
import { UserDetailModal } from '@/components/admin/UserDetailModal';
import { relativeTime } from '@/lib/theses';

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  institution: { name: string } | null;
  createdAt: string;
}

interface UsersResponse {
  items: AdminUserListItem[];
  nextCursor: string | null;
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

function displayName(u: AdminUserListItem): string {
  return u.name?.trim() || u.email;
}

function AdminUsersContent() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [profileType, setProfileType] = useState(searchParams.get('profileType') ?? '');
  const [status, setStatus] = useState('');
  const [extraItems, setExtraItems] = useState<AdminUserListItem[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Debounce the search box — server-side search, so every keystroke
  // shouldn't fire a request.
  useEffect(() => {
    const id = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(id);
  }, [qInput]);

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set('role', 'USER');
    if (q) params.set('q', q);
    if (profileType) params.set('profileType', profileType);
    if (status) params.set('status', status);
    return `/api/admin/users?${params.toString()}`;
  }, [q, profileType, status]);

  const {
    data: usersRes,
    loading: usersLoading,
    refresh: refreshUsers,
  } = useApi<UsersResponse>(apiPath, { skip: !me });

  useEffect(() => {
    setExtraItems([]);
    setExtraCursor(null);
  }, [apiPath]);

  const items = useMemo(() => [...(usersRes?.items ?? []), ...extraItems], [usersRes, extraItems]);
  const cursor = extraCursor !== null ? extraCursor : (usersRes?.nextCursor ?? null);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const sep = apiPath.includes('?') ? '&' : '?';
      const page = await api<UsersResponse>(`${apiPath}${sep}cursor=${encodeURIComponent(cursor)}`);
      setExtraItems((prev) => [...prev, ...page.items]);
      setExtraCursor(page.nextCursor);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleMutated() {
    invalidateCachePrefix('/api/admin/users');
    void refreshUsers();
  }

  if (!user) {
    return <LoadingScreen />;
  }

  if (meError) {
    router.replace('/dashboard');
    return null;
  }

  if (!me) {
    return <LoadingScreen />;
  }

  return (
    <AdminShell
      email={me.admin.email}
      role={me.admin.role}
      header={
        <div className="px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
            Administration
          </div>
          <h1 className="text-xl font-semibold font-headings text-foreground">
            Gestion des utilisateurs
          </h1>
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Icon
              i="search"
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <select
            value={profileType}
            onChange={(e) => setProfileType(e.target.value)}
            className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Tous les profils</option>
            <option value="ETUDIANT">Étudiant</option>
            <option value="ENCADRANT">Encadrant</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="SUSPENDED">Suspendu</option>
          </select>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[2fr_120px_1.2fr_110px_140px_80px] gap-2 px-5 py-2 border-b border-border bg-background">
                {['Utilisateur', 'Profil', 'Établissement', 'Statut', 'Inscrit le', ''].map((h) => (
                  <div
                    key={h}
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </div>
                ))}
              </div>

              {usersLoading && items.length === 0 ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[2fr_120px_1.2fr_110px_140px_80px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))
              ) : items.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground motion-safe:animate-fade-in">
                  Aucun utilisateur ne correspond à cette recherche.
                </p>
              ) : (
                items.map((u) => (
                  <div
                    key={u.id}
                    className="grid grid-cols-[2fr_120px_1.2fr_110px_140px_80px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={displayName(u)}
                        src={u.avatarUrl}
                        className="h-8 w-8 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {displayName(u)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                    </div>
                    <div className="text-sm text-foreground">
                      {u.profileType ? PROFILE_TYPE_LABELS[u.profileType] : '—'}
                    </div>
                    <div className="text-sm text-foreground truncate pr-2">
                      {u.institution?.name ?? '—'}
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[u.status]}`}
                      >
                        {STATUS_LABELS[u.status]}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">{relativeTime(u.createdAt)}</div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(u.id)}
                        className="text-sm font-medium text-primary transition duration-150 hover:opacity-80"
                      >
                        Voir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {cursor && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="self-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 transition duration-150 hover:bg-input"
          >
            {loadingMore ? 'Chargement…' : 'Charger plus'}
          </button>
        )}
      </div>

      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          can={me.can}
          currentAdminId={me.admin.id}
          onClose={() => setSelectedUserId(null)}
          onMutated={handleMutated}
        />
      )}
    </AdminShell>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={null}>
      <AdminUsersContent />
    </Suspense>
  );
}
