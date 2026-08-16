// Admin → Monitoring — one service status card (Application / Neon /
// Vercel / GitHub / Cloudinary / Resend / Upstash / Bictorys).
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { relativeTime } from '@/lib/theses';
import {
  SERVICE_LABELS,
  SERVICE_ICONS,
  STATUS_LABELS,
  STATUS_DOT,
  STATUS_BADGE,
  type ServiceKey,
  type ServiceStatus,
} from '@/lib/monitoring';

interface MonitoringServiceCardProps {
  service: ServiceKey;
  status: ServiceStatus;
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  activeIncidents: number;
}

export function MonitoringServiceCard({
  service,
  status,
  lastCheckedAt,
  lastLatencyMs,
  lastError,
  activeIncidents,
}: MonitoringServiceCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon i={SERVICE_ICONS[service]} size={16} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">
            {SERVICE_LABELS[service]}
          </span>
        </div>
        <span
          className={`shrink-0 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Dernière vérification</span>
          <span className="text-foreground">
            {lastCheckedAt ? relativeTime(lastCheckedAt) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Temps de réponse</span>
          <span className="text-foreground">
            {lastLatencyMs != null ? `${lastLatencyMs} ms` : '—'}
          </span>
        </div>
        {activeIncidents > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Incidents actifs</span>
            <span className="font-semibold text-danger">{activeIncidents}</span>
          </div>
        )}
      </div>

      {status === 'UNVERIFIED' ? (
        <p className="text-xs text-muted-foreground italic leading-snug">
          Non vérifiable automatiquement{lastError ? ` — ${lastError}` : ''}
        </p>
      ) : (
        lastError && (
          <p className="text-xs text-danger leading-snug line-clamp-2" title={lastError}>
            {lastError}
          </p>
        )
      )}
    </div>
  );
}

export function MonitoringServiceCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
