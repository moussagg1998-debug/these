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
import { StudentNav } from './StudentNav';
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

  const { data: commentsRes, refresh: refreshComments } = useApi<CommentsResponse>(
    `/api/theses/${thesisPath}/comments`,
    { skip: !thesis },
  );

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
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="comments" />
        <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!thesis) {
    return (
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="comments" />
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun encadrant ne vous a encore assigné de mémoire.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-body bg-background min-h-screen">
      <StudentNav name={name} active="comments" />
      <div className="px-4 py-6 sm:px-8">
        <div className="border border-border rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-surface">
            <div className="text-sm font-semibold font-headings text-foreground">Commentaires</div>
          </div>
          {comments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Aucun commentaire pour l&apos;instant.
            </p>
          ) : (
            comments.map((c) => <StudentCommentItem key={c.id} comment={c} />)
          )}
          <form onSubmit={onSend} className="flex flex-col gap-2 p-5 border-t border-border">
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Votre message…"
              className="border border-border rounded-sm px-3 py-2 text-sm text-foreground bg-input outline-none resize-none"
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="self-end flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-sm disabled:opacity-50"
            >
              <Icon i="send" size={12} />
              {sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
