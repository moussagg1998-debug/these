// Admin — Gestion des documents. KPI grid (same AdminKpiCard primitive as
// /admin/emails) over Document + FileUpload + UploadErrorEvent, a recent-
// documents list, and a lazy-loaded orphaned-files panel.
//
// "Stockage utilisé" / "Taille moyenne des fichiers" are computed over
// FileUpload (the generic upload ledger — also fed by avatars and message
// attachments, see documents-stats/route.ts's doc comment), not Document
// alone, because FileUpload.sizeBytes is always populated while
// Document.sizeBytes is optional and often null. Labeled accordingly below
// rather than presented as a document-only figure it isn't.
'use client';

import { useUser } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminKpiCard, AdminKpiCardSkeleton } from '@/components/admin/AdminKpiCard';
import { formatBytes } from '@/lib/utils';
import { formatTime } from '@/lib/monitoring';

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface RecentDocument {
  id: string;
  chapter: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  thesisTopic: string;
  studentName: string;
}

interface DocumentsStatsResponse {
  windowHours: number;
  documentCount: number;
  recentDocuments: RecentDocument[];
  storageBytes: number;
  avgFileSizeBytes: number;
  uploadErrors24h: number;
  cloudinaryErrors24h: number;
}

interface OrphanFile {
  id: string;
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface OrphansResponse {
  scanned: number;
  orphanCount: number;
  orphans: OrphanFile[];
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} à ${formatTime(iso)}`;
}

export default function AdminDocumentsPage() {
  const user = useUser();
  const router = useRouter();

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });
  const { data: stats, loading: statsLoading } = useApi<DocumentsStatsResponse>(
    '/api/admin/documents-stats',
    { skip: !me },
  );
  const { data: orphansRes, loading: orphansLoading } = useApi<OrphansResponse>(
    '/api/admin/documents-stats/orphans',
    { skip: !me },
  );

  if (!user) {
    return <LoadingScreen />;
  }

  if (meError) {
    router.replace('/dashboard');
    return null;
  }

  if (!me) {
    return <LoadingScreen />;
  }

  const orphans = orphansRes?.orphans ?? [];

  return (
    <AdminShell
      email={me.admin.email}
      role={me.admin.role}
      header={
        <div className="px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
            Administration
          </div>
          <h1 className="text-xl font-semibold font-headings text-foreground">
            Gestion des documents
          </h1>
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-6 px-4 py-6 sm:px-8">
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsLoading && !stats ? (
              <>
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
              </>
            ) : (
              <>
                <AdminKpiCard
                  icon="file-text"
                  label="Documents déposés"
                  value={NUMBER_FORMAT.format(stats?.documentCount ?? 0)}
                />
                <AdminKpiCard
                  icon="database"
                  label="Stockage utilisé (tous fichiers)"
                  value={formatBytes(stats?.storageBytes ?? 0)}
                />
                <AdminKpiCard
                  icon="upload"
                  label="Taille moyenne des fichiers"
                  value={formatBytes(stats?.avgFileSizeBytes ?? 0)}
                />
                <AdminKpiCard
                  icon="alert-triangle"
                  label={`Erreurs d'upload (${stats?.windowHours ?? 24}h)`}
                  value={NUMBER_FORMAT.format(stats?.uploadErrors24h ?? 0)}
                />
                <AdminKpiCard
                  icon="cloud"
                  label={`Erreurs Cloudinary (${stats?.windowHours ?? 24}h)`}
                  value={NUMBER_FORMAT.format(stats?.cloudinaryErrors24h ?? 0)}
                />
                <AdminKpiCard
                  icon="alert-circle"
                  label="Fichiers orphelins"
                  value={NUMBER_FORMAT.format(orphansRes?.orphanCount ?? 0)}
                />
              </>
            )}
          </div>
          <p className="flex items-start gap-1.5 mt-3 text-xs text-muted-foreground">
            <Icon i="info" size={12} className="mt-0.5 shrink-0" />
            <span>
              « Stockage utilisé » et « taille moyenne » couvrent tous les fichiers Cloudinary
              (documents, avatars, pièces jointes de messages) — pas seulement les documents de
              thèse — car c&apos;est la seule table où la taille est toujours renseignée.
            </span>
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Documents récents</h2>
          <div className="rounded-md border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[1fr_200px_120px_170px] gap-2 px-5 py-2 border-b border-border bg-background">
                  {['Document', 'Étudiant', 'Taille', 'Déposé le'].map((h) => (
                    <div
                      key={h}
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </div>
                  ))}
                </div>
                {statsLoading && !stats ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">Chargement…</p>
                ) : (stats?.recentDocuments.length ?? 0) === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">
                    Aucun document déposé pour le moment.
                  </p>
                ) : (
                  stats?.recentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="grid grid-cols-[1fr_200px_120px_170px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-foreground truncate">
                          {doc.fileName ?? doc.chapter ?? 'Document'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {doc.thesisTopic}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {doc.studentName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {doc.sizeBytes ? formatBytes(doc.sizeBytes) : '—'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {dateLabel(doc.uploadedAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Fichiers orphelins {orphans.length > 0 && `(${orphans.length})`}
          </h2>
          {orphansLoading && !orphansRes ? (
            <div className="rounded-md border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : orphans.length === 0 ? (
            <div className="rounded-md border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
              Aucun fichier orphelin détecté parmi les {orphansRes?.scanned ?? 0} fichiers les plus
              récents (hors dernière heure).
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {orphans.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <Icon i="alert-triangle" size={14} className="text-warning shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm text-foreground truncate">{f.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.mimeType} · {formatBytes(f.sizeBytes)} · {dateLabel(f.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
