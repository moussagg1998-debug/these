// Commentaires — Vue d'ensemble — Banani `CommentsOverview.jsx`.
//
// Cross-thesis aggregate — fetches GET /api/comments once (unfiltered
// beyond `studentId`) and filters/counts client-side, same pattern as the
// Phase 3 Students List FilterBar — this keeps the header counts ("N en
// cours · M résolus") accurate regardless of which tab is active, and lets
// a resolve toggle update counts instantly without a refetch. "Non lus"
// stays inert (no read-receipt model exists — see
// phase-4-documents-comments.md); the other 3 tabs map to real fields.
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { CommentThread } from '@/components/dashboard/CommentThread';
import { StudentCommentsContent } from '@/components/student/StudentCommentsContent';
import { displayName, type CommentListItem, type ThesisListItem } from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface CommentsResponse {
  items: CommentListItem[];
  nextCursor: string | null;
  total: number;
}

interface ThesesResponse {
  items: ThesisListItem[];
}

type FilterId = 'open' | 'resolved' | 'high' | 'unread';

const FILTERS: { id: FilterId; label: string; disabled?: boolean }[] = [
  { id: 'open', label: 'En cours' },
  { id: 'resolved', label: 'Résolus' },
  { id: 'high', label: 'Priorité haute' },
  { id: 'unread', label: 'Non lus', disabled: true },
];

function CommentsOverviewContent() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const studentIdFilter = searchParams.get('studentId');
  const [activeFilter, setActiveFilter] = useState<FilterId>('open');
  const [resolvedOverrides, setResolvedOverrides] = useState<Record<string, boolean>>({});
  const [extraItems, setExtraItems] = useState<CommentListItem[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const apiPath = studentIdFilter
    ? `/api/comments?studentId=${encodeURIComponent(studentIdFilter)}`
    : '/api/comments';
  const { data: commentsRes, loading: commentsLoading } = useApi<CommentsResponse>(apiPath, {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });
  const { data: theses } = useApi<ThesesResponse>('/api/theses', {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });

  useEffect(() => {
    setExtraItems([]);
    setExtraCursor(null);
  }, [apiPath]);

  const cursor = extraCursor !== null ? extraCursor : (commentsRes?.nextCursor ?? null);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const sep = apiPath.includes('?') ? '&' : '?';
      const page = await api<CommentsResponse>(
        `${apiPath}${sep}cursor=${encodeURIComponent(cursor)}`,
      );
      setExtraItems((prev) => [...prev, ...page.items]);
      setExtraCursor(page.nextCursor);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  const allItems = useMemo(
    () =>
      [...(commentsRes?.items ?? []), ...extraItems].map((c) =>
        resolvedOverrides[c.id] !== undefined ? { ...c, resolved: resolvedOverrides[c.id]! } : c,
      ),
    [commentsRes, extraItems, resolvedOverrides],
  );

  const counts = useMemo(() => {
    const resolved = allItems.filter((c) => c.resolved).length;
    return { open: allItems.length - resolved, resolved };
  }, [allItems]);

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'open':
        return allItems.filter((c) => !c.resolved);
      case 'resolved':
        return allItems.filter((c) => c.resolved);
      case 'high':
        return allItems.filter((c) => c.priority === 'high');
      default:
        return allItems;
    }
  }, [allItems, activeFilter]);

  function onResolvedChange(id: string, resolved: boolean) {
    setResolvedOverrides((prev) => ({ ...prev, [id]: resolved }));
  }

  if (!user || profileLoading || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  if (profile.profileType === null) {
    router.replace('/onboarding/profile');
    return null;
  }

  if (profile.profileType === 'ETUDIANT') {
    const studentName = profile.name || user.email.split('@')[0] || user.email;
    return <StudentCommentsContent name={studentName} />;
  }

  const name = profile.name || user.email.split('@')[0] || user.email;
  const studentName = studentIdFilter
    ? theses?.items.find((t) => t.student.id === studentIdFilter)?.student
    : null;

  return (
    <DashboardShell
      name={name}
      header={<DashboardHeader eyebrow="Encadrement" title="Commentaires & Retours" />}
    >
      <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8">
        {studentIdFilter && studentName && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Filtré pour {displayName(studentName)}</span>
            <button
              type="button"
              onClick={() => router.push('/comments')}
              className="text-primary font-medium"
            >
              Retirer le filtre
            </button>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold font-headings text-foreground">
                Tous les commentaires
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {counts.open} commentaire{counts.open > 1 ? 's' : ''} en cours · {counts.resolved}{' '}
                résolu{counts.resolved > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={f.disabled}
                title={f.disabled ? 'Bientôt disponible' : undefined}
                onClick={() => !f.disabled && setActiveFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-sm ${
                  f.disabled
                    ? 'cursor-not-allowed bg-surface border border-border text-muted-foreground opacity-50'
                    : f.id === activeFilter
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface border border-border text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {commentsLoading && !commentsRes ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-8 text-center">
            <p className="text-sm text-muted-foreground">Aucun commentaire dans cette catégorie.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                onResolvedChange={onResolvedChange}
              />
            ))}
          </div>
        )}
        {cursor && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="text-xs font-medium text-primary border border-primary px-4 py-2 rounded-sm disabled:opacity-50"
            >
              {loadingMore ? 'Chargement…' : 'Charger plus'}
            </button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function CommentsOverviewPage() {
  return (
    <Suspense fallback={null}>
      <CommentsOverviewContent />
    </Suspense>
  );
}
