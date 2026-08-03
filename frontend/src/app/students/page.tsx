// Mes étudiants — Liste — Banani `StudentList.jsx`.
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StudentRow } from '@/components/dashboard/StudentRow';
import { FilterBar, STAGE_FILTERS, type StageFilterId } from '@/components/dashboard/FilterBar';
import { AddStudentForm } from '@/components/dashboard/AddStudentForm';
import type { ThesisListItem } from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface ThesesResponse {
  items: ThesisListItem[];
  nextCursor: string | null;
}

export default function StudentListPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StageFilterId>('all');

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const {
    data: theses,
    loading: thesesLoading,
    refresh: refreshTheses,
  } = useApi<ThesesResponse>('/api/theses', {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });

  const items = useMemo(() => theses?.items ?? [], [theses]);

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
    if (!filter?.stage) return items;
    return items.filter((t) => t.stage === filter.stage);
  }, [items, activeFilter]);

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
    <DashboardShell name={name}>
      <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
            Encadrement · Année 2024–2025
          </div>
          <h1 className="text-xl font-semibold font-headings text-foreground">Mes étudiants</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold font-headings text-foreground">
              Liste complète
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {items.length} étudiant{items.length > 1 ? 's' : ''} en encadrement
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
            <div className="border border-border rounded-md overflow-hidden">
              <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 bg-input border-b border-border">
                <div className="w-72 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                <div className="w-24 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Retours
                </div>
                <div className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Échéance
                </div>
                <div className="shrink-0 w-16" />
              </div>
              {filtered.map((thesis) => (
                <StudentRow key={thesis.id} thesis={thesis} />
              ))}
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
