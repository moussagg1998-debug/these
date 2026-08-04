// Bibliothèque de documents — Banani `DocumentsLibrary.jsx`.
//
// Cross-thesis aggregate (see .planning/banani/phase-4-documents-comments.md)
// — fetches GET /api/documents rather than the per-thesis nested route.
// "Tous les étudiants" filter is populated from the real /api/theses list;
// "Tous les types" is derived client-side from the file extension (no
// `type` column exists — same derivation Banani's own mock data used).
// "Tous les mois" filters client-side on `uploadedAt`. The search box stays
// decorative, same treatment as the dashboard/students search boxes.
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DocumentRow } from '@/components/dashboard/DocumentRow';
import {
  displayName,
  documentFormat,
  type DocumentListItem,
  type ThesisListItem,
} from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface DocumentsResponse {
  items: DocumentListItem[];
  nextCursor: string | null;
  total: number;
}

interface ThesesResponse {
  items: ThesisListItem[];
}

function DocumentsLibraryContent() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const studentIdFilter = searchParams.get('studentId');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [extraItems, setExtraItems] = useState<DocumentListItem[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const apiPath = studentIdFilter
    ? `/api/documents?studentId=${encodeURIComponent(studentIdFilter)}`
    : '/api/documents';
  const { data: docsRes, loading: docsLoading } = useApi<DocumentsResponse>(apiPath, {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });
  const { data: theses } = useApi<ThesesResponse>('/api/theses', {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });

  useEffect(() => {
    setExtraItems([]);
    setExtraCursor(null);
  }, [apiPath]);

  const items = useMemo(() => [...(docsRes?.items ?? []), ...extraItems], [docsRes, extraItems]);
  const cursor = extraCursor !== null ? extraCursor : (docsRes?.nextCursor ?? null);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const sep = apiPath.includes('?') ? '&' : '?';
      const page = await api<DocumentsResponse>(
        `${apiPath}${sep}cursor=${encodeURIComponent(cursor)}`,
      );
      setExtraItems((prev) => [...prev, ...page.items]);
      setExtraCursor(page.nextCursor);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  const months = useMemo(() => {
    const set = new Set(
      items.map((d) =>
        new Date(d.uploadedAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      ),
    );
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((d) => {
      if (typeFilter !== 'all' && documentFormat(d).toLowerCase() !== typeFilter) return false;
      if (monthFilter !== 'all') {
        const label = new Date(d.uploadedAt).toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric',
        });
        if (label !== monthFilter) return false;
      }
      return true;
    });
  }, [items, typeFilter, monthFilter]);

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
  const studentName = studentIdFilter
    ? theses?.items.find((t) => t.student.id === studentIdFilter)?.student
    : null;

  return (
    <DashboardShell name={name}>
      <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
            Encadrement · Année 2024–2025
          </div>
          <h1 className="text-xl font-semibold font-headings text-foreground">
            Bibliothèque de documents
          </h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8">
        {studentIdFilter && studentName && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Filtré pour {displayName(studentName)}</span>
            <button
              type="button"
              onClick={() => router.push('/documents')}
              className="text-primary font-medium"
            >
              Retirer le filtre
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2 overflow-x-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-border rounded-sm px-3 py-1.5 bg-surface text-xs text-muted-foreground outline-none"
            >
              <option value="all">Tous les types</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="pptx">PPTX</option>
            </select>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="border border-border rounded-sm px-3 py-1.5 bg-surface text-xs text-muted-foreground outline-none"
            >
              <option value="all">Tous les mois</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-muted-foreground">
            {filtered.length} document{filtered.length > 1 ? 's' : ''}
          </div>
        </div>

        {docsLoading && !docsRes ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun document déposé pour l&apos;instant.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <div className="hidden lg:flex items-center gap-4 px-5 py-3 bg-input border-b border-border">
              <div className="w-40 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Nom du fichier
              </div>
              <div className="w-48 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Étudiant
              </div>
              <div className="w-28 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Étape
              </div>
              <div className="w-32 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date de dépôt
              </div>
              <div className="w-20 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Taille
              </div>
              <div className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Format
              </div>
              <div className="shrink-0 w-16" />
            </div>
            {filtered.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
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

        <div className="mt-8 p-4 bg-surface border border-border rounded-md flex items-start gap-3">
          <Icon i="info" size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Tous les documents soumis par vos étudiants sont archivés ici. Cliquez sur l&apos;icône
            de téléchargement pour ouvrir un fichier.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function DocumentsLibraryPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsLibraryContent />
    </Suspense>
  );
}
