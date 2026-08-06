// Banani `StudentRow.jsx` — one row in the student supervision table. Wired
// to a real ThesisListItem instead of the mock array Banani hardcoded.
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import {
  STAGE_COLORS,
  URGENCY_DOT,
  displayName,
  formatDate,
  relativeTime,
  urgencyFromDueDate,
  type ThesisListItem,
} from '@/lib/theses';

export function StudentRow({ thesis }: { thesis: ThesisListItem }) {
  const name = displayName(thesis.student);
  const stageClass = STAGE_COLORS[thesis.stage] || 'bg-muted text-muted-foreground';
  const deadline = thesis.deadlines[0];
  const urgency = deadline ? urgencyFromDueDate(deadline.dueAt) : 'low';
  const dotClass = URGENCY_DOT[urgency] || 'bg-muted';
  const lastDoc = thesis.documents[0];
  const pendingComments = thesis._count.comments;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 border-b border-border bg-surface transition-colors duration-150 hover:bg-input/40 lg:flex-row lg:items-center lg:gap-4">
      {/* Avatar + name + topic */}
      <div className="flex items-center gap-3 lg:w-64 lg:shrink-0">
        <Avatar name={name} className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground leading-snug line-clamp-1">
            {thesis.topic}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:contents">
        {/* Stage badge */}
        <div className="lg:w-28 lg:shrink-0">
          <span className={`text-xs font-medium px-2 py-1 rounded-sm ${stageClass}`}>
            {thesis.stage}
          </span>
        </div>

        {/* Progress bar */}
        <div className="lg:w-36 lg:shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-16 lg:flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${thesis.progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-8 text-right">{thesis.progress}%</span>
          </div>
        </div>

        {/* Last submission */}
        <div className="lg:w-36 lg:shrink-0 text-sm text-muted-foreground">
          {lastDoc ? relativeTime(lastDoc.uploadedAt) : 'Aucune'}
        </div>

        {/* Pending comments */}
        <div className="lg:w-20 lg:shrink-0 flex items-center gap-1.5">
          {pendingComments > 0 ? (
            <>
              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {pendingComments} retour{pendingComments > 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>

        {/* Deadline */}
        <div className="flex items-center gap-2 lg:flex-1">
          <span className={`w-2 h-2 rounded-full ${dotClass} shrink-0`} />
          <span className="text-sm text-foreground">
            {deadline ? formatDate(deadline.dueAt) : 'Aucune échéance'}
          </span>
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0 self-start lg:self-center">
        <Link
          href={`/students/${thesis.id}`}
          className="block whitespace-nowrap text-xs font-medium text-primary border border-primary px-3 py-1.5 rounded-sm transition-colors duration-150 hover:bg-primary hover:text-primary-foreground"
        >
          Ouvrir
        </Link>
      </div>
    </div>
  );
}
