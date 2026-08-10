// Messagerie — Banani `StudentMessaging.jsx` (ETUDIANT) + `new_screen7.jsx`
// "Messagerie — Côté Encadrant" (ENCADRANT, Phase 11).
//
// Same profileType-branch pattern as /settings (Phase 6) and /dashboard
// (Phase 7) — one route, one page, branching on profile.profileType rather
// than two separate URLs. Already referenced as a real Link from Phase 7's
// StudentDashboardContent ("Envoyer un message").
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { StudentMessagingContent } from '@/components/student/StudentMessagingContent';
import { EncadrantMessagingContent } from '@/components/dashboard/EncadrantMessagingContent';
import type { ThesisListItem } from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface ThesesResponse {
  items: ThesisListItem[];
}

export default function MessagesPage() {
  const user = useUser();
  const router = useRouter();

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const isStudent = profile?.profileType === 'ETUDIANT';
  const isEncadrant = profile?.profileType === 'ENCADRANT';
  const { data: thesesRes } = useApi<ThesesResponse>('/api/theses', {
    skip: !user || !isStudent,
  });
  const thesis = thesesRes?.items[0] ?? null;

  const stillResolving = !user || profileLoading || !profile || (isStudent && !thesesRes);
  const needsOnboarding = !stillResolving && profile?.profileType === null;
  const studentWithoutThesis = !stillResolving && isStudent && !thesis;

  useEffect(() => {
    if (needsOnboarding) router.replace('/onboarding/profile');
    else if (studentWithoutThesis) router.replace('/dashboard');
  }, [needsOnboarding, studentWithoutThesis, router]);

  if (stillResolving || needsOnboarding || studentWithoutThesis) {
    return <LoadingScreen />;
  }

  const name = profile!.name || profile!.email.split('@')[0] || profile!.email;

  if (isEncadrant) {
    return <EncadrantMessagingContent name={name} />;
  }

  return <StudentMessagingContent name={name} thesis={thesis!} />;
}
