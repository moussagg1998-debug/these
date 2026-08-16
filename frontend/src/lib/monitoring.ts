// Admin monitoring center — client-safe labels/icons/formatters shared by
// the Admin → Monitoring page and its components. The server-only checker
// logic lives in frontend/src/lib/server/monitoring/* (that module tree is
// `server-only` gated so it can't be imported from here).
import { getDatePreferences } from '@/lib/datePreferences';

export const SERVICE_KEYS = [
  'application',
  'neon',
  'vercel',
  'github',
  'cloudinary',
  'resend',
  'upstash',
  'bictorys',
] as const;

export type ServiceKey = (typeof SERVICE_KEYS)[number];
export type ServiceStatus = 'OPERATIONAL' | 'WARNING' | 'CRITICAL' | 'UNVERIFIED';

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  application: 'Application',
  neon: 'Neon / PostgreSQL',
  vercel: 'Vercel',
  github: 'GitHub',
  cloudinary: 'Cloudinary',
  resend: 'Resend',
  upstash: 'Upstash',
  bictorys: 'Bictorys',
};

export const SERVICE_ICONS: Record<ServiceKey, string> = {
  application: 'server',
  neon: 'database',
  vercel: 'triangle',
  github: 'github',
  cloudinary: 'cloud',
  resend: 'mail',
  upstash: 'zap',
  bictorys: 'credit-card',
};

export const STATUS_LABELS: Record<ServiceStatus, string> = {
  OPERATIONAL: 'Opérationnel',
  WARNING: 'Avertissement',
  CRITICAL: 'Incident',
  UNVERIFIED: 'Non vérifié',
};

export const STATUS_DOT: Record<ServiceStatus, string> = {
  OPERATIONAL: 'bg-success',
  WARNING: 'bg-warning',
  CRITICAL: 'bg-danger',
  UNVERIFIED: 'bg-muted-foreground',
};

export const STATUS_BADGE: Record<ServiceStatus, string> = {
  OPERATIONAL: 'bg-success/15 text-success',
  WARNING: 'bg-warning/15 text-warning',
  CRITICAL: 'bg-danger/15 text-danger',
  UNVERIFIED: 'bg-muted text-muted-foreground',
};

// Admin -> Centre d'alertes — MonitoringIncident.status/.severity vocabulary.
// Distinct from ServiceStatus above: a service's live health (OPERATIONAL/
// WARNING/CRITICAL/UNVERIFIED) vs. an individual incident's triage workflow
// (has anyone looked at it yet?) and how bad it was when detected.
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type IncidentSeverity = 'CRITICAL' | 'WARNING';

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Nouvelle',
  ACKNOWLEDGED: 'En cours',
  RESOLVED: 'Résolue',
};

export const INCIDENT_STATUS_BADGE: Record<IncidentStatus, string> = {
  OPEN: 'bg-danger/15 text-danger',
  ACKNOWLEDGED: 'bg-warning/15 text-warning',
  RESOLVED: 'bg-success/15 text-success',
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  CRITICAL: 'Critique',
  WARNING: 'Avertissement',
};

export const INCIDENT_SEVERITY_ICON: Record<IncidentSeverity, string> = {
  CRITICAL: 'alert-circle',
  WARNING: 'alert-triangle',
};

/** "23:42" style — honors the signed-in user's timezone preference, same source as formatDate() in lib/theses.ts. */
export function formatTime(iso: string): string {
  const { timezone } = getDatePreferences();
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

export function humanizeDuration(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return remMinutes > 0 ? `${hours} h ${remMinutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days} j ${remHours} h` : `${days} j`;
}
