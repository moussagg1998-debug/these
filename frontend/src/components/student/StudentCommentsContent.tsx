// Student "Commentaires" page — the full comment thread on the student's
// own thesis (both sides, unlike StudentDashboardContent's embedded card
// which filters to encadrant-authored only), plus a composer so the
// student can reply. POST /api/theses/[id]/comments already allows either
// party — only the UI to call it as a student was missing. Flat thread,
// no parentId/nested replies (spec decision).
'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useApi } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { Icon } from '@/components/ui/Icon';
import { StudentShell } from './StudentShell';
import { StudentCommentItem } from './StudentCommentItem';
import type { ThesisListItem, ThesisPerson } from '@/lib/theses';

interface ThesesResponse {
  items: ThesisListItem[];
}

interface CommentRow {
  id: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  author: ThesisPerson;
  document: { chapter: string | null } | null;
}

interface CommentsResponse {
  items: CommentRow[];
}

interface StudentCommentsContentProps {
  name: string;
}

export function StudentCommentsContent({ name }: StudentCommentsContentProps) {
  const { toast } = useToast();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const { data: thesesRes, loading: thesesLoading } = useApi<ThesesResponse>('/api/theses');
  const thesis = thesesRes?.items[0] ?? null;
  const thesisPath = thesis ? thesis.id : 'pending';

  const {
    data: commentsRes,
    error: commentsError,
    refresh: refreshComments,
  } = useApi<CommentsResponse>(`/api/theses/${thesisPath}/comments`, { skip: !thesis });

  const comments = useMemo(() => commentsRes?.items ?? [], [commentsRes]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || !thesis) return;
    setSending(true);
    try {
      await api(`/api/theses/${thesis.id}/comments`, { method: 'POST', body: { body } });
      toast('Message envoyé.', 'success');
      setBody('');
      void refreshComments();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setSending(false);
    }
  }

  if (thesesLoading && !thesesRes) {
    return (
      <StudentShell name={name} active="comments">
        <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
      </StudentShell>
    );
  }

  if (!thesis) {
    return (
      <StudentShell name={name} active="comments">
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun encadrant ne vous a encore assigné de mémoire.
          </p>
        </div>
      </StudentShell>
    );
  }

  if (!commentsRes && !commentsError) {
    return (
      <StudentShell name={name} active="comments">
        <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
      </StudentShell>
    );
  }

  return (
    <StudentShell name={name} active="comments">
      <div className="px-4 py-6 sm:px-8">
        <div className="flex flex-col border border-border rounded-md overflow-hidden bg-background">
          <div className="px-5 py-4 border-b border-border bg-surface">
            <div className="text-sm font-semibold font-headings text-foreground">Commentaires</div>
          </div>
          {/* Bounded + independently scrollable, so the composer below never
              gets pushed out of view as the thread grows — same pattern as
              StudentMessagingContent's conversation pane. */}
          <div className="flex-1 overflow-y-auto max-h-[60vh]">
            {comments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Aucun commentaire pour l&apos;instant.
              </p>
            ) : (
              comments.map((c) => <StudentCommentItem key={c.id} comment={c} />)
            )}
          </div>
          <form
            onSubmit={onSend}
            className="flex items-end gap-3 p-4 border-t border-border bg-surface"
          >
            <textarea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Votre message…"
              className="flex-1 border border-border rounded-sm px-3 py-2 text-sm text-foreground bg-input outline-none resize-none"
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-medium rounded-sm disabled:opacity-50 shrink-0"
            >
              <Icon i="send" size={12} />
              {sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </form>
        </div>
      </div>
    </StudentShell>
  );
}
