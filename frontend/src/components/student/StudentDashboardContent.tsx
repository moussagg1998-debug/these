// Dashboard Étudiant — Banani `new_screen5.jsx`.
//
// Kept in its own file rather than inlined in dashboard/page.tsx (unlike
// Phase 6's EncadrantSettingsContent) purely for size — this screen spans 4
// API calls and ~9 data-driven sections. See
// .planning/banani/phase-7-dashboard-etudiant.md for every field-scope
// decision below.
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { StudentShell } from './StudentShell';
import { StudentDocumentRow } from './StudentDocumentRow';
import { StudentCommentItem } from './StudentCommentItem';
import {
  STAGE_COLORS,
  displayName,
  formatDate,
  type ThesisDeadline,
  type ThesisDocument,
  type ThesisListItem,
  type ThesisPerson,
} from '@/lib/theses';

interface ThesesResponse {
  items: ThesisListItem[];
}

interface DocumentsResponse {
  items: ThesisDocument[];
}

interface CommentRow {
  id: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  author: ThesisPerson;
  document: { id: string; chapter: string | null } | null;
}

interface CommentsResponse {
  items: CommentRow[];
}

interface DeadlinesResponse {
  items: ThesisDeadline[];
}

interface StudentDashboardContentProps {
  name: string;
}

export function StudentDashboardContent({ name }: StudentDashboardContentProps) {
  const { data: thesesRes, loading: thesesLoading } = useApi<ThesesResponse>('/api/theses');
  const thesis = thesesRes?.items[0] ?? null;
  const thesisPath = thesis ? thesis.id : 'pending';

  const { data: docsRes } = useApi<DocumentsResponse>(`/api/theses/${thesisPath}/documents`, {
    skip: !thesis,
  });
  const { data: commentsRes } = useApi<CommentsResponse>(`/api/theses/${thesisPath}/comments`, {
    skip: !thesis,
  });
  const { data: deadlinesRes } = useApi<DeadlinesResponse>(`/api/theses/${thesisPath}/deadlines`, {
    skip: !thesis,
  });

  const documents = useMemo(() => docsRes?.items ?? [], [docsRes]);

  const commentedDocIds = useMemo(() => {
    const ids = (commentsRes?.items ?? []).map((c) => c.document?.id).filter(Boolean);
    return new Set(ids);
  }, [commentsRes]);

  const encadrantComments = useMemo(
    () => (commentsRes?.items ?? []).filter((c) => c.author.id === thesis?.encadrant.id),
    [commentsRes, thesis],
  );

  const unresolvedCount = useMemo(
    () => encadrantComments.filter((c) => !c.resolved).length,
    [encadrantComments],
  );

  const latestUnresolved = useMemo(
    () => [...encadrantComments].reverse().find((c) => !c.resolved) ?? null,
    [encadrantComments],
  );

  const nextDeadline = deadlinesRes?.items[0] ?? null;
  const laterDeadlines = useMemo(() => (deadlinesRes?.items ?? []).slice(1, 3), [deadlinesRes]);

  if (thesesLoading && !thesesRes) {
    return (
      <StudentShell name={name} active="dashboard">
        <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
      </StudentShell>
    );
  }

  if (!thesis) {
    return (
      <StudentShell name={name} active="dashboard">
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun encadrant ne vous a encore assigné de mémoire.
          </p>
        </div>
      </StudentShell>
    );
  }

  const stageClass = STAGE_COLORS[thesis.stage] || 'bg-muted text-muted-foreground';

  return (
    <StudentShell name={name} active="dashboard">
      <div className="flex flex-col lg:flex-row px-4 py-6 sm:px-8 gap-6">
        {/* LEFT — main content */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          {/* Header card */}
          <div className="border border-border rounded-md p-6 bg-surface">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Sujet de mémoire
                </div>
                <h1 className="text-lg font-semibold font-headings text-foreground max-w-xl leading-snug">
                  {thesis.topic}
                </h1>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className={`text-xs px-2 py-1 rounded-sm font-medium ${stageClass}`}>
                  {thesis.stage}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Encadrant : {displayName(thesis.encadrant)}</span>
              {nextDeadline && (
                <>
                  <div className="hidden sm:block w-px h-4 bg-border mx-2" />
                  <div className="flex items-center gap-1.5">
                    <Icon i="calendar" size={12} />
                    <span>Échéance : {formatDate(nextDeadline.dueAt)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Progress card — real stage + progress%, replacing Banani's fake
              8-step curriculum pills (no schema field backs sub-milestones) */}
          <div className="border border-border rounded-md p-5 bg-background">
            <div className="text-sm font-semibold font-headings text-foreground mb-5">
              Avancement global — {thesis.progress}%
            </div>
            <div className="w-full h-2 bg-input rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${thesis.progress}%` }} />
            </div>
          </div>

          {/* Documents */}
          <div className="border border-border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface">
              <div className="text-sm font-semibold font-headings text-foreground">
                Mes documents
              </div>
              <Link
                href="/documents/new"
                className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground bg-primary px-3 py-1.5 rounded-sm"
              >
                <Icon i="upload" size={12} />
                Déposer un fichier
              </Link>
            </div>
            {documents.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Aucun document déposé pour l&apos;instant.
              </p>
            ) : (
              documents.map((doc) => (
                <StudentDocumentRow
                  key={doc.id}
                  doc={doc}
                  commented={commentedDocIds.has(doc.id)}
                />
              ))
            )}
          </div>

          {/* Comments */}
          <div className="border border-border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface">
              <div className="text-sm font-semibold font-headings text-foreground">
                Retours de mon encadrant
              </div>
              {unresolvedCount > 0 && (
                <div className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                  {unresolvedCount} non résolu{unresolvedCount > 1 ? 's' : ''}
                </div>
              )}
            </div>
            {encadrantComments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Aucun retour pour l&apos;instant.
              </p>
            ) : (
              encadrantComments.map((c) => <StudentCommentItem key={c.id} comment={c} />)
            )}
          </div>
        </div>

        {/* RIGHT sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          {/* Prochaine échéance */}
          <div className="border border-border rounded-md p-4 bg-surface">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Prochaine échéance
            </div>
            {nextDeadline ? (
              <div className="flex items-center gap-2 p-3 bg-warning rounded-sm">
                <Icon i="alert-circle" size={16} className="text-warning-foreground shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-warning-foreground">
                    {nextDeadline.title}
                  </div>
                  <div className="text-xs text-warning-foreground opacity-80">
                    {formatDate(nextDeadline.dueAt)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Aucune échéance à venir.</p>
            )}
            {laterDeadlines.map((deadline, i) => (
              <div
                key={deadline.id}
                className={`flex items-center justify-between text-xs text-muted-foreground py-2 ${
                  i < laterDeadlines.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span>{deadline.title}</span>
                <span className="font-medium text-foreground">{formatDate(deadline.dueAt)}</span>
              </div>
            ))}
          </div>

          {/* Dernier retour non lu */}
          {latestUnresolved && (
            <div className="border border-primary rounded-md p-4 bg-secondary">
              <div className="text-xs font-medium uppercase tracking-widest text-secondary-foreground mb-2">
                À traiter
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Icon i="message-circle" size={14} className="text-secondary-foreground" />
                <span className="text-xs font-semibold text-secondary-foreground">
                  {unresolvedCount} commentaire{unresolvedCount > 1 ? 's' : ''} en attente
                </span>
              </div>
              <p className="text-xs text-secondary-foreground leading-relaxed">
                {latestUnresolved.body}
              </p>
            </div>
          )}

          {/* Encadrant */}
          <div className="border border-border rounded-md p-4 bg-surface">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Mon encadrant
            </div>
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={displayName(thesis.encadrant)} className="h-10 w-10" />
              <div className="text-sm font-semibold text-foreground">
                {displayName(thesis.encadrant)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-3">{thesis.encadrant.email}</div>
            {thesis.encadrant.bio && (
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {thesis.encadrant.bio}
              </p>
            )}
            <Link
              href="/messages"
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-input border border-border text-foreground py-2 rounded-sm"
            >
              <Icon i="send" size={12} />
              Envoyer un message
            </Link>
          </div>

          {/* Conseils */}
          <div className="border border-border rounded-md p-4 bg-background">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
              Conseil
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Soumettez vos chapitres tôt pour avoir le temps de les réviser après les retours de
              votre encadrant.
            </p>
          </div>
        </div>
      </div>
    </StudentShell>
  );
}
