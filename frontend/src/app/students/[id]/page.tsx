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
import { DashboardShell } from '@/components/dashboard/DashboardShell';
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
        <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
      </DashboardShell>
    );
  }

  const studentName = thesis.student.name || thesis.student.email.split('@')[0];
  const deadline = thesis.deadlines[0];

  return (
    <DashboardShell name={name}>
      <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
            Encadrement · Année 2024–2025
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/students"
              className="text-lg font-semibold font-headings text-primary underline"
            >
              Mes étudiants
            </Link>
            <Icon i="chevron-right" size={16} className="text-muted-foreground" />
            <h1 className="text-lg font-semibold font-headings text-foreground">{studentName}</h1>
          </div>
        </div>
      </div>

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
                <button
                  key={tab}
                  type="button"
                  disabled
                  title="Bientôt disponible"
                  className="shrink-0 cursor-not-allowed px-3 py-2 text-sm font-medium text-muted-foreground"
                >
                  {tab}
                </button>
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
                  <div className="h-full bg-primary" style={{ width: `${thesis.progress}%` }} />
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
              <p className="text-sm text-muted-foreground">Aucune activité pour l&apos;instant.</p>
            ) : (
              <div className="space-y-3">
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
        />
      </div>
    </DashboardShell>
  );
}
