// Admin — Audit Log. Dedicated, full-page ledger over AdminAction — every
// back-office mutation ("actions sensibles") with actor, action, target,
// metadata diff, and IP. Consumes the pre-existing GET /api/admin/audit-log
// route (D-AUDIT-01), which this feature only widened with `actorEmail`.
// Cursor pagination mirrors /admin/alerts's "Charger plus" pattern.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { AdminShell } from '@/components/admin/AdminShell';
import { formatTime } from '@/lib/monitoring';

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface AuditLogRow {
  id: string;
  actorId: string;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogResponse {
  items: AuditLogRow[];
  nextCursor: string | null;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} à ${formatTime(iso)}`;
}

export default function AdminAuditLogPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extraItems, setExtraItems] = useState<AuditLogRow[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (targetType) params.set('targetType', targetType);
    const qs = params.toString();
    return `/api/admin/audit-log${qs ? `?${qs}` : ''}`;
  }, [action, targetType]);

  const { data: logRes, loading: logLoading } = useApi<AuditLogResponse>(apiPath, { skip: !me });

  const items = useMemo(() => [...(logRes?.items ?? []), ...extraItems], [logRes, extraItems]);
  const cursor = extraCursor !== null ? extraCursor : (logRes?.nextCursor ?? null);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const sep = apiPath.includes('?') ? '&' : '?';
      const page = await api<AuditLogResponse>(
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
            Journal d&apos;audit
          </h1>
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Action (ex. user.suspend)"
            className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="text"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            placeholder="Type de cible (ex. User)"
            className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[190px_1fr_190px_170px_140px_180px] gap-2 px-5 py-2 border-b border-border bg-background">
                {['Date', 'Acteur', 'Action', 'Cible', 'IP', ''].map((h) => (
                  <div
                    key={h}
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </div>
                ))}
              </div>

              {logLoading && items.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">Chargement…</p>
              ) : items.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  Aucune action enregistrée pour ce filtre.
                </p>
              ) : (
                items.map((row) => {
                  const expanded = expandedId === row.id;
                  return (
                    <div key={row.id} className="border-b border-border last:border-0">
                      <div className="grid grid-cols-[190px_1fr_190px_170px_140px_180px] gap-2 items-center px-5 py-3">
                        <div className="text-sm text-muted-foreground">
                          {dateLabel(row.createdAt)}
                        </div>
                        <div className="text-sm text-foreground truncate">
                          {row.actorEmail ?? row.actorId}
                        </div>
                        <div className="text-sm font-mono text-foreground truncate">
                          {row.action}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {row.targetType
                            ? `${row.targetType}${row.targetId ? ` #${row.targetId.slice(0, 8)}` : ''}`
                            : '—'}
                        </div>
                        <div className="text-sm text-muted-foreground">{row.ip ?? '—'}</div>
                        <div>
                          {row.metadata && (
                            <button
                              type="button"
                              onClick={() => setExpandedId(expanded ? null : row.id)}
                              className="flex items-center gap-1 text-xs font-medium text-primary transition duration-150 hover:opacity-80"
                            >
                              <Icon i={expanded ? 'chevron-up' : 'chevron-down'} size={12} />
                              Détail
                            </button>
                          )}
                        </div>
                      </div>
                      {expanded && row.metadata && (
                        <pre className="mx-5 mb-3 overflow-x-auto rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {cursor && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="self-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 transition duration-150 hover:bg-input"
          >
            {loadingMore ? 'Chargement…' : 'Charger plus'}
          </button>
        )}
      </div>
    </AdminShell>
  );
}
