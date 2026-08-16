// Comment list + composer for the PDF viewer (/documents/[id]/view) —
// shared by both roles. Distinct from dashboard/CommentThread.tsx, which
// renders a cross-thesis triage card with a resolved toggle for
// "Commentaires — Vue d'ensemble"; this is a flat, single-document list
// with an optional page-number anchor, and no resolved/priority triage
// (out of scope — see docs/superpowers/specs/
// 2026-08-15-document-pdf-annotations-design.md).
'use client';

import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { displayName, relativeTime } from '@/lib/theses';

export interface DocumentComment {
  id: string;
  body: string;
  createdAt: string;
  page: number | null;
  parentId: string | null;
  author: { id: string; name: string | null; email: string; avatarUrl: string | null };
  document: { id: string; chapter: string | null } | null;
}

interface DocumentCommentPanelProps {
  thesisId: string;
  documentId: string;
  comments: DocumentComment[];
  onCommentAdded: () => void;
}

export function DocumentCommentPanel({
  thesisId,
  documentId,
  comments,
  onCommentAdded,
}: DocumentCommentPanelProps) {
  const { toast } = useToast();
  const [body, setBody] = useState('');
  const [page, setPage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await api(`/api/theses/${thesisId}/comments`, {
        method: 'POST',
        body: {
          body: trimmed,
          documentId,
          ...(page.trim() ? { page: Number(page.trim()) } : {}),
        },
      });
      setBody('');
      setPage('');
      onCommentAdded();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 border-t lg:border-t-0 border-border">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-semibold font-headings text-foreground">Commentaires</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun commentaire pour ce document.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className={`flex gap-3 ${c.parentId ? 'ml-6 opacity-90' : ''}`}>
              <Avatar
                name={displayName(c.author)}
                src={c.author.avatarUrl}
                className="h-7 w-7 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {displayName(c.author)}
                  </span>
                  {c.page != null && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent">
                      p. {c.page}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground leading-relaxed">{c.body}</p>
                <span className="text-xs text-muted-foreground">{relativeTime(c.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 px-4 py-3 border-t border-border shrink-0"
      >
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ajouter un commentaire…"
          className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none resize-none focus:border-primary"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder="Page (optionnel)"
            className="w-32 rounded-sm border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="ml-auto flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Icon i="send" size={14} />
            {submitting ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </form>
    </div>
  );
}
