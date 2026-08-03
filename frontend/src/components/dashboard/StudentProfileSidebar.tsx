// Banani `StudentProfileSidebar.jsx` — right rail on Détail Étudiant.
//
// "Envoyer un retour" is a real inline comment composer (not a stub) — it
// calls the already-shipped POST /api/theses/[id]/comments (Phase 1), so
// this is a small complete feature, not half of the bigger Phase 4
// commenting UI (thread view, replies, per-document anchoring).
'use client';

import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  displayName,
  formatDate,
  type ThesisDeadline,
  type ThesisDocument,
  type ThesisPerson,
} from '@/lib/theses';

interface StudentProfileSidebarProps {
  thesisId: string;
  student: ThesisPerson;
  stage: string;
  progress: number;
  deadline?: ThesisDeadline | undefined;
  pendingComments: number;
  recentDocuments: ThesisDocument[];
}

export function StudentProfileSidebar({
  thesisId,
  student,
  stage,
  progress,
  deadline,
  pendingComments,
  recentDocuments,
}: StudentProfileSidebarProps) {
  const { toast } = useToast();
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const name = displayName(student);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await api(`/api/theses/${thesisId}/comments`, { method: 'POST', body: { body } });
      toast('Retour envoyé.', 'success');
      setBody('');
      setComposerOpen(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col px-5 py-6 gap-6">
      <div className="flex items-start gap-4 pb-4 border-b border-border">
        <Avatar name={name} className="h-14 w-14 rounded-md" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{student.email}</div>
          <div className="text-xs font-medium text-secondary-foreground bg-secondary px-1.5 py-0.5 rounded-sm mt-1.5 inline-block">
            {stage}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Progression
          </div>
          <div className="text-sm font-semibold text-foreground">{progress}%</div>
        </div>
        <div className="w-full h-2 bg-input rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-secondary to-primary"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
          Date limite
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-input rounded-sm border border-border">
          <Icon i="calendar" size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {deadline ? formatDate(deadline.dueAt) : 'Aucune échéance'}
          </span>
        </div>
      </div>

      {recentDocuments.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
            Documents récents
          </div>
          <div className="flex flex-col gap-2">
            {recentDocuments.map((doc) => (
              <a
                key={doc.id}
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-2 bg-input rounded-sm border border-border"
              >
                <Icon i="file-text" size={14} className="text-primary" />
                <span className="text-xs font-medium text-foreground truncate">
                  {doc.chapter || 'Document'}
                </span>
                <Icon
                  i="external-link"
                  size={12}
                  className="text-muted-foreground ml-auto shrink-0"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {pendingComments > 0 && (
        <div className="p-3 bg-secondary/10 border border-secondary rounded-sm">
          <div className="flex items-center gap-2 mb-2">
            <Icon i="message-circle" size={14} className="text-secondary-foreground" />
            <span className="text-xs font-medium text-secondary-foreground">
              {pendingComments} retour{pendingComments > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        {composerOpen ? (
          <form onSubmit={onSend} className="flex flex-col gap-2">
            <textarea
              autoFocus
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Votre retour…"
              className="border border-border rounded-sm px-3 py-2 text-sm text-foreground bg-input outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground text-xs font-medium rounded-sm disabled:opacity-50"
              >
                <Icon i="send" size={12} />
                {sending ? 'Envoi…' : 'Envoyer'}
              </button>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="px-3 py-2.5 border border-border text-foreground text-xs font-medium rounded-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground text-xs font-medium rounded-sm"
          >
            <Icon i="send" size={12} />
            Envoyer un retour
          </button>
        )}
        <button
          type="button"
          disabled
          title="Bientôt disponible"
          className="flex cursor-not-allowed items-center justify-center gap-2 px-3 py-2.5 bg-surface border border-border text-muted-foreground text-xs font-medium rounded-sm"
        >
          <Icon i="more-vertical" size={12} />
          Plus d&apos;options
        </button>
      </div>
    </div>
  );
}
