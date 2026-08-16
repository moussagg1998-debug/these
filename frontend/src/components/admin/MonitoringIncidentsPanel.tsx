// Admin → Monitoring — active-incident banners (spec format: "🔴 Incident
// critique — {service} / {error} / Détecté à : HH:mm / Dernière vérification
// réussie : HH:mm", or "🟡 Avertissement — {service}" for WARNING-severity
// rows) + paginated incident history table (resolved rows show "🟢 Incident
// résolu — {service} / Durée : X minutes"). Full triage (acknowledge/mark as
// treated) lives on the dedicated Admin → Centre d'alertes page
// (/admin/alerts) — this panel stays a read-only summary, same as before.
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  SERVICE_LABELS,
  INCIDENT_SEVERITY_LABELS,
  formatTime,
  humanizeDuration,
  type ServiceKey,
  type IncidentStatus,
  type IncidentSeverity,
} from '@/lib/monitoring';

export interface OpenIncidentView {
  id: string;
  service: ServiceKey;
  severity: IncidentSeverity;
  detectedError: string;
  detectedAt: string;
  lastSuccessAt: string | null;
}

export interface IncidentHistoryRow {
  id: string;
  service: ServiceKey;
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectedError: string;
  detectedAt: string;
  resolvedAt: string | null;
  durationMs: number | null;
}

interface MonitoringIncidentsPanelProps {
  openIncidents: OpenIncidentView[];
  history: IncidentHistoryRow[];
  historyLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function MonitoringIncidentsPanel({
  openIncidents,
  history,
  historyLoading,
  hasMore,
  onLoadMore,
}: MonitoringIncidentsPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Incidents actifs {openIncidents.length > 0 && `(${openIncidents.length})`}
        </h2>
        {openIncidents.length === 0 ? (
          <div className="rounded-md border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
            Aucun incident actif.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {openIncidents.map((incident) => {
              const critical = incident.severity === 'CRITICAL';
              return (
                <div
                  key={incident.id}
                  className={
                    critical
                      ? 'flex flex-col gap-1 rounded-md border border-danger/40 bg-danger/10 px-4 py-3'
                      : 'flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/10 px-4 py-3'
                  }
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      i={critical ? 'alert-circle' : 'alert-triangle'}
                      size={14}
                      className={`${critical ? 'text-danger' : 'text-warning'} shrink-0`}
                    />
                    <span
                      className={`text-sm font-semibold ${critical ? 'text-danger' : 'text-warning'}`}
                    >
                      {INCIDENT_SEVERITY_LABELS[incident.severity]} —{' '}
                      {SERVICE_LABELS[incident.service]}
                    </span>
                  </div>
                  <p className="text-xs text-foreground">{incident.detectedError}</p>
                  <p className="text-xs text-muted-foreground">
                    Détecté à : {formatTime(incident.detectedAt)}
                    {incident.lastSuccessAt &&
                      ` — Dernière vérification réussie : ${formatTime(incident.lastSuccessAt)}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Historique des incidents</h2>
        <div className="rounded-md border border-border overflow-hidden">
          {historyLoading && history.length === 0 ? (
            <div className="divide-y divide-border">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="px-4 py-4 text-xs text-muted-foreground">
              Aucun incident enregistré pour l&apos;instant.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {history.map((row) => {
                const resolved = row.status === 'RESOLVED';
                const critical = row.severity === 'CRITICAL';
                return (
                  <div key={row.id} className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon
                        i={resolved ? 'check-circle' : critical ? 'alert-circle' : 'alert-triangle'}
                        size={13}
                        className={
                          resolved ? 'text-success' : critical ? 'text-danger' : 'text-warning'
                        }
                      />
                      <span className="text-sm font-medium text-foreground">
                        {resolved ? 'Incident résolu' : INCIDENT_SEVERITY_LABELS[row.severity]} —{' '}
                        {SERVICE_LABELS[row.service]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {row.detectedError}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Détecté à : {formatTime(row.detectedAt)}
                      {!resolved
                        ? ` — ${row.status === 'ACKNOWLEDGED' ? 'en cours' : 'nouvelle'}`
                        : row.durationMs != null &&
                          ` — Durée : ${humanizeDuration(row.durationMs)}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={historyLoading}
            className="mt-2 text-xs font-medium text-primary transition-opacity duration-150 hover:opacity-80 disabled:opacity-50"
          >
            {historyLoading ? 'Chargement…' : 'Voir plus'}
          </button>
        )}
      </div>
    </div>
  );
}
