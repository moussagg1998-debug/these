// Shared types + formatting helpers for the Encadrant thesis-tracking pages
// (/dashboard, /students, /students/[id]) — kept in one place so the three
// pages and their shared components (StudentRow, ActivityItem, …) agree on
// the shape returned by GET /api/theses(/[id]).

export interface ThesisPerson {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface ThesisDocument {
  id: string;
  chapter: string | null;
  fileUrl: string;
  uploadedAt: string;
}

export interface ThesisDeadline {
  id: string;
  title: string;
  dueAt: string;
  urgency: string;
}

export interface ThesisListItem {
  id: string;
  topic: string;
  stage: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  student: ThesisPerson;
  encadrant: ThesisPerson;
  documents: ThesisDocument[];
  deadlines: ThesisDeadline[];
  _count: { comments: number };
}

export const STAGE_COLORS: Record<string, string> = {
  Rédaction: 'bg-secondary text-secondary-foreground',
  Révision: 'bg-warning text-warning-foreground',
  Soutenance: 'bg-success text-success-foreground',
  'En attente': 'bg-muted text-muted-foreground',
  Bloqué: 'bg-danger text-danger-foreground',
};

export const URGENCY_DOT: Record<string, string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-success',
};

/** Days until `dueAt` → urgency bucket, matching the dot colors above. */
export function urgencyFromDueDate(dueAt: string): 'low' | 'medium' | 'high' {
  const days = (new Date(dueAt).getTime() - Date.now()) / 86_400_000;
  if (days < 3) return 'high';
  if (days < 14) return 'medium';
  return 'low';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** French relative time for "Dernière soumission" / activity feeds. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'il y a 1 mois' : `il y a ${months} mois`;
}

export function displayName(person: ThesisPerson): string {
  return person.name || person.email.split('@')[0] || person.email;
}
