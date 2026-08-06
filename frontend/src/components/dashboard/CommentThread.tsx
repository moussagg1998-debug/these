// Banani `CommentThread.jsx` — one feedback thread in "Commentaires — Vue
// d'ensemble". Banani's status dot was purely decorative (a plain `<a>`
// with no href); making it a real button that calls PATCH /api/comments/[id]
// is the obvious behavior for a screen whose entire purpose is triage.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { displayName, documentDisplayName, relativeTime, type CommentListItem } from '@/lib/theses';

const PRIORITY_BORDER: Record<string, string> = {
  high: 'border-l-4 border-danger',
  medium: 'border-l-4 border-warning',
  low: 'border-l-4 border-success',
};

interface CommentThreadProps {
  comment: CommentListItem;
  onResolvedChange: (id: string, resolved: boolean) => void;
}

export function CommentThread({ comment, onResolvedChange }: CommentThreadProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const priorityClass = PRIORITY_BORDER[comment.priority] || 'border-l-4 border-border';
  const statusBg = comment.resolved ? 'bg-secondary' : 'bg-muted';
  const student = displayName(comment.thesis.student);

  async function toggleResolved(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const next = !comment.resolved;
    try {
      await api(`/api/comments/${comment.id}`, { method: 'PATCH', body: { resolved: next } });
      onResolvedChange(comment.id, next);
      toast(next ? 'Commentaire marqué résolu.' : 'Commentaire rouvert.', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex gap-4 p-4 border border-border rounded-md bg-surface transition-shadow duration-150 motion-safe:hover:shadow-md ${priorityClass}`}
    >
      <Avatar name={student} className="h-9 w-9 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/students/${comment.thesis.id}`}
                className="font-medium text-sm text-foreground hover:underline"
              >
                {student}
              </Link>
              {comment.document?.chapter && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {comment.document.chapter}
                  </span>
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {comment.document ? documentDisplayName(comment.document) : comment.thesis.topic}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleResolved}
            disabled={busy}
            title={comment.resolved ? 'Marquer non résolu' : 'Marquer résolu'}
            className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition duration-150 motion-safe:active:scale-90 ${statusBg} disabled:opacity-50`}
          >
            <Icon
              i={comment.resolved ? 'check-circle' : 'circle'}
              size={12}
              className={comment.resolved ? 'text-secondary-foreground' : 'text-muted-foreground'}
            />
          </button>
        </div>

        <p className="text-sm text-foreground leading-relaxed mb-3">{comment.body}</p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{relativeTime(comment.createdAt)}</span>
          {comment._count.replies > 0 && (
            <Link href={`/students/${comment.thesis.id}`} className="text-primary font-medium">
              {comment._count.replies} réponse{comment._count.replies > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
