// Student "Documents" page — full (unpaginated) version of the "Mes
// documents" card already embedded on StudentDashboardContent. Reuses
// StudentDocumentRow as-is; same `commented` derivation as the dashboard
// (a document with >=1 linked comment shows "Commenté").
'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { StudentNav } from './StudentNav';
import { StudentDocumentRow } from './StudentDocumentRow';
import type { ThesisDocument, ThesisListItem } from '@/lib/theses';

interface ThesesResponse {
  items: ThesisListItem[];
}

interface DocumentsResponse {
  items: ThesisDocument[];
}

interface CommentRow {
  document: { id: string } | null;
}

interface CommentsResponse {
  items: CommentRow[];
}

interface StudentDocumentsContentProps {
  name: string;
}

export function StudentDocumentsContent({ name }: StudentDocumentsContentProps) {
  const { data: thesesRes, loading: thesesLoading } = useApi<ThesesResponse>('/api/theses');
  const thesis = thesesRes?.items[0] ?? null;
  const thesisPath = thesis ? thesis.id : 'pending';

  const { data: docsRes } = useApi<DocumentsResponse>(`/api/theses/${thesisPath}/documents`, {
    skip: !thesis,
  });
  const { data: commentsRes } = useApi<CommentsResponse>(`/api/theses/${thesisPath}/comments`, {
    skip: !thesis,
  });

  const documents = useMemo(() => docsRes?.items ?? [], [docsRes]);

  const commentedDocIds = useMemo(() => {
    const ids = (commentsRes?.items ?? []).map((c) => c.document?.id).filter(Boolean);
    return new Set(ids);
  }, [commentsRes]);

  if (thesesLoading && !thesesRes) {
    return (
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="documents" />
        <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!thesis) {
    return (
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="documents" />
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun encadrant ne vous a encore assigné de mémoire.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-body bg-background min-h-screen">
      <StudentNav name={name} active="documents" />
      <div className="px-4 py-6 sm:px-8">
        <div className="border border-border rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface">
            <div className="text-sm font-semibold font-headings text-foreground">Mes documents</div>
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
              <StudentDocumentRow key={doc.id} doc={doc} commented={commentedDocIds.has(doc.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
