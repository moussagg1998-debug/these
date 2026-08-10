// Détail Étudiant — Profil — Banani `StudentDetail.jsx`.
//
// Only "Aperçu" has inline content — its own overview panels + activity
// feed, merged client-side from the documents/comments endpoints (see
// phase-3-encadrant-core.md). "Documents"/"Commentaires" link out to the
// Phase 4 aggregate pages (/documents, /comments) pre-filtered by student;
// "Historique" stays inert — no Banani source exists for its content.
'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StudentProfileSidebar } from '@/components/dashboard/StudentProfileSidebar';
import {
  relativeTime,
  type ThesisDocument,
  type ThesisPerson,
  type ThesisDeadline,
} from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface ThesisDetail {
  id: string;
  topic: string;
  stage: string;
  progress: number;
  student: ThesisPerson;
  encadrant: ThesisPerson;
  deadlines: ThesisDeadline[];
  _count: { comments: number };
}

interface DocumentsResponse {
  items: ThesisDocument[];
}

interface CommentAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  author: CommentAuthor;
}

interface CommentsResponse {
  items: CommentItem[];
}

const TABS = ['Aperçu', 'Documents', 'Commentaires', 'Historique'] as const;

// "Documents"/"Commentaires" now have real destinations as of Phase 4;
// "Historique" stays inert — no Banani source exists for its content.
const TAB_LINKS: Partial<Record<(typeof TABS)[number], string>> = {
  Documents: '/documents',
  Commentaires: '/comments',
};

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const router = useRouter();

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const {
    data: thesis,
    loading: thesisLoading,
    error: thesisError,
    refresh: refreshThesis,
  } = useApi<ThesisDetail>(`/api/theses/${id}`, {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });
  const { data: documents } = useApi<DocumentsResponse>(`/api/theses/${id}/documents`, {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });
  const { data: comments, refresh: refreshComments } = useApi<CommentsResponse>(
    `/api/theses/${id}/comments`,
    { skip: !user || profile?.profileType !== 'ENCADRANT' },
  );

  const activity = useMemo(() => {
    const docItems = (documents?.items ?? []).map((d) => ({
      key: `doc-${d.id}`,
      icon: 'upload',
      color: 'bg-secondary text-secondary-foreground',
      title: d.chapter ? `Soumission : ${d.chapter}` : 'Nouveau document soumis',
      time: d.uploadedAt,
    }));
    const commentItems = (comments?.items ?? []).map((c) => ({
      key: `comment-${c.id}`,
      icon: 'message-circle',
      color: 'bg-warning text-warning-foreground',
      title: `${c.author.name || 'Commentaire'} : ${c.body.slice(0, 80)}${c.body.length > 80 ? '…' : ''}`,
      time: c.createdAt,
    }));
    return [...docItems, ...commentItems]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);
  }, [documents, comments]);

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

  if (thesisError) {
    return (
      <DashboardShell name={name}>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-sm text-muted-foreground">Cet étudiant est introuvable.</p>
          <Link href="/students" className="text-sm font-medium text-primary underline">
            Retour à la liste
          </Link>
        </main>
      </DashboardShell>
    );
  }

  if (thesisLoading || !thesis) {
    return (
      <DashboardShell name={name}>
        <div className="flex-1 flex flex-col lg:flex-row gap-0 min-w-0">
          <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8">
            <div className="flex items-center gap-6 pb-4 border-b border-border mb-6">
              {TABS.map((tab) => (
                <Skeleton key={tab} className="h-4 w-16" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-24 w-full mb-6" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col px-5 py-6 gap-4">
            <div className="flex items-start gap-4 pb-4 border-b border-border">
              <Skeleton className="h-14 w-14 rounded-md" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  const studentName = thesis.student.name || thesis.student.email.split('@')[0];
  const deadline = thesis.deadlines[0];

  return (
    <DashboardShell
      name={name}
      header={
        <DashboardHeader
          eyebrow="Encadrement"
          title={
            <span className="flex items-center gap-3">
              <Link href="/students" className="text-primary underline">
                Mes étudiants
              </Link>
              <Icon i="chevron-right" size={16} className="text-muted-foreground shrink-0" />
              <span className="truncate">{studentName}</span>
            </span>
          }
        />
      }
    >
      <div className="flex-1 flex flex-col lg:flex-row gap-0 min-w-0">
        <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8">
          <div className="flex items-center gap-6 pb-4 border-b border-border mb-6 overflow-x-auto">
            {TABS.map((tab) => {
              if (tab === 'Aperçu') {
                return (
                  <span
                    key={tab}
                    className="shrink-0 px-3 py-2 text-sm font-medium text-primary border-b-2 border-primary"
                  >
                    {tab}
                  </span>
                );
              }
              const href = TAB_LINKS[tab];
              if (href) {
                return (
                  <Link
                    key={tab}
                    href={`${href}?studentId=${thesis.student.id}`}
                    className="shrink-0 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    {tab}
                  </Link>
                );
              }
              return (
                <Tooltip key={tab} label="Bientôt disponible">
                  <button
                    type="button"
                    disabled
                    className="shrink-0 cursor-not-allowed px-3 py-2 text-sm font-medium text-muted-foreground"
                  >
                    {tab}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="border border-border rounded-md p-4">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Étape actuelle
              </div>
              <div className="text-lg font-semibold text-foreground">{thesis.stage}</div>
            </div>
            <div className="border border-border rounded-md p-4">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Progression
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground">{thesis.progress}%</span>
                <div className="flex-1 h-2 bg-input rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${thesis.progress}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="border border-border rounded-md p-4">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Retours
              </div>
              <div className="text-lg font-semibold text-danger">{thesis._count.comments}</div>
            </div>
          </div>

          <div className="border border-border rounded-md p-5 mb-6">
            <div className="text-sm font-semibold font-headings text-foreground mb-2">
              Sujet de recherche
            </div>
            <p className="text-sm text-foreground leading-relaxed">{thesis.topic}</p>
          </div>

          <div>
            <div className="text-sm font-semibold font-headings text-foreground mb-4">
              Activité récente
            </div>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground motion-safe:animate-fade-in">
                Aucune activité pour l&apos;instant.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {activity.map((a) => (
                  <div
                    key={a.key}
                    className="flex items-start gap-4 p-3 border border-border rounded-md"
                  >
                    <div
                      className={`w-10 h-10 rounded-full ${a.color} flex items-center justify-center shrink-0`}
                    >
                      <Icon i={a.icon} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{a.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {relativeTime(a.time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <StudentProfileSidebar
          thesisId={thesis.id}
          student={thesis.student}
          stage={thesis.stage}
          progress={thesis.progress}
          deadline={deadline}
          pendingComments={thesis._count.comments}
          recentDocuments={(documents?.items ?? []).slice(0, 2)}
          onCommentSent={() => {
            void refreshComments();
            void refreshThesis();
          }}
          onStageChanged={() => void refreshThesis()}
          onArchived={() => router.push('/students')}
        />
      </div>
    </DashboardShell>
  );
}
