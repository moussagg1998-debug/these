// A single encadrant-authored comment on the student dashboard's "Retours
// de mon encadrant" panel. The "Marquer comme résolu" button is rendered
// but disabled: Banani's own two screens disagree on who resolves a comment
// (the encadrant's Comments Overview treats it as the encadrant's triage
// call, by deliberate Phase 4 design — PATCH /api/comments/[id] is
// encadrant-only) — not silently overturned here (see
// phase-7-dashboard-etudiant.md).
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { displayName, relativeTime, type ThesisPerson } from '@/lib/theses';

interface StudentCommentItemProps {
  comment: {
    id: string;
    body: string;
    resolved: boolean;
    createdAt: string;
    author: ThesisPerson;
    document: { chapter: string | null } | null;
  };
}

export function StudentCommentItem({ comment }: StudentCommentItemProps) {
  return (
    <div
      className={`px-5 py-4 border-b border-border last:border-0 transition-colors duration-150 hover:bg-input/30 ${comment.resolved ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Avatar name={displayName(comment.author)} className="h-6 w-6" />
          <span className="text-xs font-semibold text-foreground">
            {displayName(comment.author)}
          </span>
          <span className="text-xs text-muted-foreground">{relativeTime(comment.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {comment.document?.chapter && (
            <span className="text-xs text-muted-foreground italic">{comment.document.chapter}</span>
          )}
          {comment.resolved && (
            <div className="text-xs px-1.5 py-0.5 bg-input text-muted-foreground rounded-sm">
              Résolu
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{comment.body}</p>
      {!comment.resolved && (
        <button
          type="button"
          disabled
          title="Réservé à votre encadrant"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium cursor-not-allowed"
        >
          <Icon i="check-circle" size={12} />
          Marquer comme résolu
        </button>
      )}
    </div>
  );
}
