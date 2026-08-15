// PDF viewer with page-anchored comments — Banani has no source screen for
// this (it's new scope beyond the original design import). Reuses the
// native browser PDF renderer (<iframe>) rather than a custom pdf.js
// integration — see docs/superpowers/specs/
// 2026-08-15-document-pdf-annotations-design.md for the accepted
// trade-offs (no x/y pin, PDF-only, native download button stays visible).
'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StudentShell } from '@/components/student/StudentShell';
import {
  DocumentCommentPanel,
  type DocumentComment,
} from '@/components/documents/DocumentCommentPanel';
import { documentDisplayName } from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface DocumentDetail {
  id: string;
  thesisId: string;
  chapter: string | null;
  fileUrl: string;
  fileName: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  scheduledAt: string | null;
  replyToDocumentId: string | null;
}

interface CommentsResponse {
  items: DocumentComment[];
}

export default function DocumentViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const router = useRouter();

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const {
    data: doc,
    loading: docLoading,
    error: docError,
  } = useApi<DocumentDetail>(`/api/documents/${id}`, { skip: !user });
  const thesisPath = doc ? doc.thesisId : 'pending';
  const { data: commentsRes, refresh: refreshComments } = useApi<CommentsResponse>(
    `/api/theses/${thesisPath}/comments`,
    { skip: !user || !doc },
  );

  if (!user || profileLoading || !profile) {
    return <LoadingScreen />;
  }

  if (profile.profileType === null) {
    router.replace('/onboarding/profile');
    return null;
  }

  const name = profile.name || user.email.split('@')[0] || user.email;
  const isStudent = profile.profileType === 'ETUDIANT';

  if (docError) {
    const notFound = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="text-sm text-muted-foreground">Ce document est introuvable.</p>
        <Link href="/documents" className="text-sm font-medium text-primary underline">
          Retour aux documents
        </Link>
      </div>
    );
    return isStudent ? (
      <StudentShell name={name} active="documents">
        {notFound}
      </StudentShell>
    ) : (
      <DashboardShell name={name}>{notFound}</DashboardShell>
    );
  }

  if (docLoading || !doc) {
    return <LoadingScreen />;
  }

  const comments = (commentsRes?.items ?? []).filter((c) => c.document?.id === id);

  const content = (
    <div className="flex flex-col lg:flex-row gap-0 min-w-0">
      <div className="flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-border">
        <iframe
          src={doc.fileUrl}
          title={documentDisplayName(doc)}
          className="w-full h-[75vh] border-0 bg-muted"
        />
      </div>
      <div className="w-full lg:w-96 shrink-0 h-[75vh] flex flex-col">
        <DocumentCommentPanel
          thesisId={doc.thesisId}
          documentId={doc.id}
          comments={comments}
          onCommentAdded={() => void refreshComments()}
        />
      </div>
    </div>
  );

  if (isStudent) {
    return (
      <StudentShell name={name} active="documents">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Link href="/documents" className="text-muted-foreground hover:text-foreground">
            <Icon i="arrow-left" size={16} />
          </Link>
          <span className="text-sm font-medium text-foreground truncate">
            {documentDisplayName(doc)}
          </span>
        </div>
        {content}
      </StudentShell>
    );
  }

  return (
    <DashboardShell
      name={name}
      header={
        <DashboardHeader
          eyebrow="Documents"
          title={
            <span className="flex items-center gap-3">
              <Link href="/documents" className="text-primary underline">
                Documents
              </Link>
              <Icon i="chevron-right" size={16} className="text-muted-foreground shrink-0" />
              <span className="truncate">{documentDisplayName(doc)}</span>
            </span>
          }
        />
      }
    >
      {content}
    </DashboardShell>
  );
}
