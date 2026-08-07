// Mes étudiants — Liste — Banani `StudentList.jsx`.
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StudentRow } from '@/components/dashboard/StudentRow';
import { FilterBar, STAGE_FILTERS, type StageFilterId } from '@/components/dashboard/FilterBar';
import { AddStudentForm } from '@/components/dashboard/AddStudentForm';
import { displayName, type ThesisListItem } from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface ThesesResponse {
  items: ThesisListItem[];
  nextCursor: string | null;
  total: number;
}

export default function StudentListPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StageFilterId>('all');
  const [search, setSearch] = useState('');
  const [extraItems, setExtraItems] = useState<ThesisListItem[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const {
    data: theses,
    loading: thesesLoading,
    refresh: baseRefreshTheses,
  } = useApi<ThesesResponse>('/api/theses', {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });

  async function refreshTheses() {
    setExtraItems([]);
    setExtraCursor(null);
    await baseRefreshTheses();
  }

  const items = useMemo(() => [...(theses?.items ?? []), ...extraItems], [theses, extraItems]);
  const cursor = extraCursor !== null ? extraCursor : (theses?.nextCursor ?? null);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api<ThesesResponse>(`/api/theses?cursor=${encodeURIComponent(cursor)}`);
      setExtraItems((prev) => [...prev, ...page.items]);
      setExtraCursor(page.nextCursor);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  const counts = useMemo(() => {
    const result: Record<StageFilterId, number> = {
      all: items.length,
      writing: 0,
      revision: 0,
      defense: 0,
      waiting: 0,
      blocked: 0,
    };
    for (const filter of STAGE_FILTERS) {
      if (filter.stage) result[filter.id] = items.filter((t) => t.stage === filter.stage).length;
    }
    return result;
  }, [items]);

  const filtered = useMemo(() => {
    const filter = STAGE_FILTERS.find((f) => f.id === activeFilter);
    const byStage = filter?.stage ? items.filter((t) => t.stage === filter.stage) : items;
    const q = search.trim().toLowerCase();
    if (!q) return byStage;
    return byStage.filter(
      (t) =>
        displayName(t.student).toLowerCase().includes(q) ||
        t.student.email.toLowerCase().includes(q) ||
        t.topic.toLowerCase().includes(q),
    );
  }, [items, activeFilter, search]);

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
    router.replace('/dashboard');
    return null;
  }

  const name = profile.name || user.email.split('@')[0] || user.email;

  function onStudentCreated(
    thesis: ThesisListItem & { student: { name: string | null; email: string } },
  ) {
    setModalOpen(false);
    void refreshTheses();
    toast(
      `${thesis.student.name || thesis.student.email} a été ajouté(e) à votre liste d'encadrement`,
      'success',
    );
  }

  return (
    <DashboardShell
      name={name}
      header={
        <DashboardHeader
          eyebrow="Encadrement"
          title="Mes étudiants"
          search={{ value: search, onChange: setSearch, placeholder: 'Rechercher un étudiant…' }}
        />
      }
    >
      <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold font-headings text-foreground">
              Liste complète
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {theses?.total ?? items.length} étudiant
              {(theses?.total ?? items.length) > 1 ? 's' : ''} en encadrement
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-xs font-medium text-primary border border-primary px-3 py-1.5 rounded-sm flex items-center gap-1.5"
          >
            <Icon i="plus" size={12} />
            Ajouter un étudiant
          </button>
        </div>

        <FilterBar active={activeFilter} onChange={setActiveFilter} counts={counts} />

        <div className="mt-5">
          {thesesLoading && !theses ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-8 text-center">
              <p className="text-sm text-muted-foreground">Aucun étudiant dans cette catégorie.</p>
            </div>
          ) : (
            <div className="border border-border rounded-md overflow-x-auto overflow-y-hidden">
              <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 bg-input border-b border-border min-w-max">
                <div className="w-64 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Étudiant · Sujet
                </div>
                <div className="w-28 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Étape
                </div>
                <div className="w-36 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avancement
                </div>
                <div className="w-36 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Dernière soumission
                </div>
                <div className="w-20 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Retours
                </div>
                <div className="flex-1 min-w-[160px] text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Échéance
                </div>
                <div className="shrink-0 w-20" />
              </div>
              <div className="min-w-max max-h-48 overflow-y-auto">
                {filtered.map((thesis) => (
                  <StudentRow key={thesis.id} thesis={thesis} />
                ))}
              </div>
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
      </div>

      {modalOpen && (
        <AddStudentForm onClose={() => setModalOpen(false)} onCreated={onStudentCreated} />
      )}
    </DashboardShell>
  );
}
