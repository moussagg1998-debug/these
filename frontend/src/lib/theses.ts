// Shared types + formatting helpers for the Encadrant thesis-tracking pages
// (/dashboard, /students, /students/[id]) — kept in one place so the three
// pages and their shared components (StudentRow, ActivityItem, …) agree on
// the shape returned by GET /api/theses(/[id]).

export interface ThesisPerson {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  /** Phase 10 — encadrant "Profil" tab bio, shown to students when set. */
  bio?: string | null;
}

export interface ThesisDocument {
  id: string;
  chapter: string | null;
  fileUrl: string;
  fileName: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
}

/** Cross-thesis row from GET /api/documents ("Bibliothèque de documents"). */
export interface DocumentListItem extends ThesisDocument {
  thesis: {
    id: string;
    topic: string;
    stage: string;
    student: ThesisPerson;
  };
}

/** Cross-thesis row from GET /api/comments ("Commentaires — Vue d'ensemble"). */
export interface CommentListItem {
  id: string;
  body: string;
  resolved: boolean;
  priority: string;
  createdAt: string;
  author: { id: string; name: string | null; avatarUrl: string | null };
  document: { id: string; chapter: string | null; fileName: string | null; fileUrl: string } | null;
  thesis: {
    id: string;
    topic: string;
    student: ThesisPerson;
  };
  _count: { replies: number };
}

export interface ThesisDeadline {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  urgency: string;
}

/** Cross-thesis row from GET /api/deadlines ("Échéances — Calendrier"). */
export interface DeadlineListItem extends ThesisDeadline {
  thesis: {
    id: string;
    topic: string;
    stage: string;
    student: ThesisPerson;
  };
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

/**
 * The 5 valid `Thesis.stage` values, in the order shown in stage pickers.
 * Single source of truth — consumed by the PATCH /api/theses/[id] Zod
 * validator and by the encadrant's stage-change `<select>`.
 */
export const THESIS_STAGES = [
  'En attente',
  'Rédaction',
  'Révision',
  'Bloqué',
  'Soutenance',
] as const;

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

/**
 * Days-until-due bucket for `DeadlineCard`'s timeline grouping ("En retard" /
 * "Urgent" / "À venir"). Distinct from the stored `Deadline.urgency` field
 * (an encadrant-set priority) — a "low priority" deadline that's overdue
 * still needs to render as critical. Boundaries match Banani's own example
 * data (-15/-8/-2 critical, 3/5/7 urgent, 32/42 upcoming, 195 future).
 */
export type DeadlineBucket = 'critical' | 'urgent' | 'upcoming' | 'future';

export function daysUntil(dueAt: string): number {
  return Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
}

export function deadlineUrgencyBucket(dueAt: string): DeadlineBucket {
  const days = daysUntil(dueAt);
  if (days < 0) return 'critical';
  if (days <= 7) return 'urgent';
  if (days <= 60) return 'upcoming';
  return 'future';
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

/**
 * Best-effort display name for a document — real uploads (Phase 6) will
 * carry `fileName`; anything created before that falls back to `chapter`
 * or the `fileUrl` basename.
 */
export function documentDisplayName(
  doc: Pick<ThesisDocument, 'fileName' | 'chapter' | 'fileUrl'>,
): string {
  if (doc.fileName) return doc.fileName;
  if (doc.chapter) return doc.chapter;
  try {
    const path = new URL(doc.fileUrl).pathname;
    return path.split('/').pop() || doc.fileUrl;
  } catch {
    return doc.fileUrl;
  }
}

/** File extension derived from the display name, uppercased (e.g. "PDF"). */
export function documentFormat(
  doc: Pick<ThesisDocument, 'fileName' | 'chapter' | 'fileUrl'>,
): string {
  const name = documentDisplayName(doc);
  const ext = name.split('.').pop();
  return ext && ext !== name ? ext.toUpperCase() : '—';
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} o`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} Ko`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} Mo`;
}
