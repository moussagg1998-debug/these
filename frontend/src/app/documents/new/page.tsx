// Dépôt de fichier étudiant — Banani `StudentFileUpload.jsx`.
//
// New nested route (`/documents/new`) rather than a branch of `/documents`
// (Phase 4's ENCADRANT-only "Bibliothèque de documents") — see
// .planning/banani/phase-8-student-file-upload.md § routing decision.
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { StudentFileUploadForm } from '@/components/student/StudentFileUploadForm';
import type { ThesisListItem } from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface ThesesResponse {
  items: ThesisListItem[];
}

export default function NewDocumentPage() {
  const user = useUser();
  const router = useRouter();

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const isStudent = profile?.profileType === 'ETUDIANT';
  const { data: thesesRes, loading: thesesLoading } = useApi<ThesesResponse>('/api/theses', {
    skip: !user || !isStudent,
  });
  const thesis = thesesRes?.items[0] ?? null;

  const stillResolving = !user || profileLoading || (isStudent && thesesLoading && !thesesRes);
  const shouldRedirect = !stillResolving && (!isStudent || !thesis);

  useEffect(() => {
    if (shouldRedirect) router.replace('/dashboard');
  }, [shouldRedirect, router]);

  if (stillResolving || shouldRedirect) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  const name = profile!.name || profile!.email.split('@')[0] || profile!.email;

  return <StudentFileUploadForm thesisId={thesis!.id} name={name} />;
}
