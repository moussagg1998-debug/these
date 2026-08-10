// Kanban — Étapes de thèse — Banani `KanbanTheses.jsx`.
//
// Nested under /students (not a new Sidebar entry) — same routing precedent
// as /students/reminders (Phase 16): a view mode reached via a button, the
// Sidebar's "Mes étudiants" item stays active via isNavItemActive's prefix
// match. Zero new backend — GET /api/theses already returns everything a
// card needs (stage, topic, deadlines, comment count). See
// .planning/banani/kanban-theses.md.
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
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KanbanCard, KanbanCardSkeleton } from '@/components/dashboard/KanbanCard';
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

// Banani's visual column order (Bloqué last, an exceptional state) — kept
// local to this screen rather than reordering the shared THESIS_STAGES
// array other pages depend on for stage-picker dropdowns.
const COLUMNS: { stage: string; label: string; badgeClass: string }[] = [
  { stage: 'En attente', label: 'En attente', badgeClass: 'bg-muted text-muted-foreground' },
  { stage: 'Rédaction', label: 'Rédaction', badgeClass: 'bg-warning text-warning-foreground' },
  { stage: 'Révision', label: 'Révision', badgeClass: 'bg-accent text-accent-foreground' },
  { stage: 'Soutenance', label: 'Soutenance', badgeClass: 'bg-success text-success-foreground' },
  { stage: 'Bloqué', label: 'Bloqué', badgeClass: 'bg-danger text-danger-foreground' },
];

export default function KanbanPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const {
    data: theses,
    loading: thesesLoading,
    refresh: refreshTheses,
  } = useApi<ThesesResponse>('/api/theses?limit=50', {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });

  // Local, optimistically-mutable mirror of the fetched list — drag-and-drop
  // updates this immediately on drop, then rolls back if the PATCH fails.
  const [items, setItems] = useState<ThesisListItem[]>([]);
  useEffect(() => {
    if (theses?.items) setItems(theses.items);
  }, [theses]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [pendingBlock, setPendingBlock] = useState<{ id: string; name: string } | null>(null);
  const [blocking, setBlocking] = useState(false);

  const columns = useMemo(
    () => COLUMNS.map((col) => ({ ...col, cards: items.filter((t) => t.stage === col.stage) })),
    [items],
  );

  function handleDragStart(e: React.DragEvent, thesisId: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', thesisId);
    setDraggedId(thesisId);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverStage(null);
  }

  async function applyStageMove(id: string, stage: string) {
    const previousItems = items;
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, stage } : t)));
    try {
      await api(`/api/theses/${id}`, { method: 'PATCH', body: { stage } });
    } catch (err) {
      setItems(previousItems);
      toast(err instanceof ApiError ? err.message : "Impossible de déplacer l'étudiant", 'error');
    }
  }

  async function handleDrop(stage: string) {
    const id = draggedId;
    setDragOverStage(null);
    setDraggedId(null);
    if (!id) return;

    const current = items.find((t) => t.id === id);
    if (!current || current.stage === stage) return;

    if (stage === 'Bloqué') {
      setPendingBlock({ id, name: displayName(current.student) });
      return;
    }
    await applyStageMove(id, stage);
  }

  async function confirmBlock() {
    if (!pendingBlock) return;
    setBlocking(true);
    await applyStageMove(pendingBlock.id, 'Bloqué');
    setBlocking(false);
    setPendingBlock(null);
  }

  if (!user || profileLoading || !profile) {
    return <LoadingScreen />;
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
          eyebrow="Mes étudiants"
          title="Vue Kanban — Étapes de thèse"
          actions={
            <Link
              href="/students"
              className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <Icon i="users" size={12} />
              Vue liste
            </Link>
          }
        />
      }
    >
      <div className="flex-1 px-4 py-6 sm:px-6">
        {thesesLoading && !theses ? (
          <div className="flex items-start gap-4 overflow-x-auto pb-2">
            {COLUMNS.map((col) => (
              <div key={col.stage} className="flex w-56 shrink-0 flex-col gap-3">
                <Skeleton className="h-6 w-24" />
                <div className="flex flex-col gap-3">
                  <KanbanCardSkeleton />
                  <KanbanCardSkeleton />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center motion-safe:animate-fade-in">
            <p className="text-sm text-muted-foreground">
              Aucun étudiant pour l&apos;instant — ajoutez-en un pour commencer le suivi.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-4 overflow-x-auto pb-2">
            {columns.map((col) => (
              <div
                key={col.stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={() => setDragOverStage(col.stage)}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOverStage((prev) => (prev === col.stage ? null : prev));
                }}
                onDrop={() => void handleDrop(col.stage)}
                className={`flex w-56 shrink-0 flex-col gap-3 rounded-md p-1.5 transition-colors duration-150 ${
                  dragOverStage === col.stage ? 'bg-primary/5 ring-2 ring-primary/30' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-sm px-2 py-1 text-xs font-semibold ${col.badgeClass}`}
                    >
                      {col.label}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {col.cards.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    aria-label="Ajouter un étudiant"
                    className="text-muted-foreground transition duration-150 hover:text-foreground motion-safe:active:scale-90"
                  >
                    <Icon i="plus" size={14} />
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {col.cards.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground motion-safe:animate-fade-in">
                      {dragOverStage === col.stage
                        ? 'Déposer ici'
                        : 'Aucun étudiant à cette étape.'}
                    </p>
                  ) : (
                    col.cards.map((thesis) => (
                      <KanbanCard
                        key={thesis.id}
                        thesis={thesis}
                        draggable
                        isDragging={draggedId === thesis.id}
                        onDragStart={(e) => handleDragStart(e, thesis.id)}
                        onDragEnd={handleDragEnd}
                      />
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground transition duration-150 hover:text-foreground hover:border-primary motion-safe:active:scale-[0.98]"
                >
                  <Icon i="plus" size={12} />
                  Ajouter un étudiant
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <AddStudentForm onClose={() => setModalOpen(false)} onCreated={onStudentCreated} />
      )}

      {pendingBlock && (
        <ConfirmModal
          title="Bloquer ce mémoire ?"
          description={`${pendingBlock.name} ne pourra plus déposer de document, envoyer de message ni commenter tant que vous n'aurez pas changé cette étape.`}
          confirmLabel="Bloquer le mémoire"
          confirmBusyLabel="Blocage…"
          tone="danger"
          busy={blocking}
          onConfirm={() => void confirmBlock()}
          onCancel={() => setPendingBlock(null)}
        />
      )}
    </DashboardShell>
  );
}
