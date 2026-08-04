// Messagerie étudiant-encadrant — Banani `StudentMessaging.jsx`.
//
// See .planning/banani/phase-9-student-messaging.md for every field-scope
// decision (no Meeting model → "Prochaine échéance" reuses the real next
// Deadline, fabricated availability/location/title dropped, "Fichiers
// récents" reuses real documents, notifications/report stay inert).
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { StudentNav } from './StudentNav';
import { AddToCalendarModal } from './AddToCalendarModal';
import {
  displayName,
  documentDisplayName,
  documentFormat,
  formatDate,
  relativeTime,
  type ThesisDeadline,
  type ThesisDocument,
  type ThesisListItem,
} from '@/lib/theses';

const POLL_INTERVAL_MS = 5000;

interface MessageRow {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

interface MessagesResponse {
  items: MessageRow[];
}
interface DeadlinesResponse {
  items: ThesisDeadline[];
}
interface DocumentsResponse {
  items: ThesisDocument[];
}

interface StudentMessagingContentProps {
  name: string;
  thesis: ThesisListItem;
}

export function StudentMessagingContent({ name, thesis }: StudentMessagingContentProps) {
  const user = useUser();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messagesRes, refresh: refreshMessages } = useApi<MessagesResponse>(
    `/api/theses/${thesis.id}/messages`,
  );
  const { data: deadlinesRes } = useApi<DeadlinesResponse>(`/api/theses/${thesis.id}/deadlines`);
  const { data: docsRes } = useApi<DocumentsResponse>(`/api/theses/${thesis.id}/documents`);

  const messages = useMemo(() => messagesRes?.items ?? [], [messagesRes]);
  const nextDeadline = deadlinesRes?.items[0] ?? null;
  const recentDocs = useMemo(() => (docsRes?.items ?? []).slice(0, 2), [docsRes]);

  // Periodic refetch, not real-time — decided in IMPLEMENTATION-PLAN.md §6
  // (no Ably wiring for MVP messaging).
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshMessages();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/theses/${thesis.id}/messages`, { method: 'POST', body: { body } });
      setDraft('');
      await refreshMessages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="font-body bg-background min-h-screen">
      <StudentNav name={name} />

      <div className="flex flex-col lg:flex-row px-4 py-6 sm:px-8 gap-6">
        {/* LEFT — conversation */}
        <div className="flex-1 flex flex-col min-w-0 border border-border rounded-md bg-background overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar name={displayName(thesis.encadrant)} className="h-10 w-10" />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {displayName(thesis.encadrant)}
                </div>
                <div className="text-xs text-muted-foreground">{thesis.encadrant.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                title="Bientôt disponible"
                className="w-8 h-8 rounded-sm border border-border flex items-center justify-center text-muted-foreground opacity-50 cursor-not-allowed"
              >
                <Icon i="phone" size={14} />
              </button>
              <button
                type="button"
                disabled
                title="Bientôt disponible"
                className="w-8 h-8 rounded-sm border border-border flex items-center justify-center text-muted-foreground opacity-50 cursor-not-allowed"
              >
                <Icon i="info" size={14} />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 flex flex-col gap-4 px-6 py-6 overflow-y-auto max-h-[60vh]"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun message pour l&apos;instant — envoyez le premier message à votre encadrant.
              </p>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <Avatar
                      name={isOwn ? name : displayName(thesis.encadrant)}
                      className="h-8 w-8 shrink-0"
                    />
                    <div className={`flex flex-col gap-1 max-w-sm ${isOwn ? 'items-end' : ''}`}>
                      <div
                        className={`px-4 py-2.5 rounded-md ${
                          isOwn ? 'bg-primary text-primary-foreground' : 'bg-input text-foreground'
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {relativeTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={onSend} className="border-t border-border px-6 py-4 bg-surface">
            {error && (
              <p role="alert" className="text-xs text-danger mb-2">
                {error}
              </p>
            )}
            <div className="flex items-end gap-3">
              <div className="flex-1 flex items-center gap-2 border border-border rounded-md px-3 py-2.5 bg-input">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Votre message…"
                  className="flex-1 text-sm text-foreground bg-transparent outline-none"
                />
                <button
                  type="button"
                  disabled
                  title="Bientôt disponible"
                  className="text-muted-foreground opacity-50 cursor-not-allowed"
                >
                  <Icon i="paperclip" size={16} />
                </button>
              </div>
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="w-9 h-9 bg-primary text-primary-foreground rounded-sm flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <Icon i="send" size={16} />
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT sidebar */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
          <div className="border border-border rounded-md p-5 bg-surface">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              Profil
            </div>
            <div className="flex flex-col items-center text-center mb-4">
              <Avatar name={displayName(thesis.encadrant)} className="h-16 w-16 mb-3" />
              <div className="text-sm font-semibold text-foreground">
                {displayName(thesis.encadrant)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{thesis.encadrant.email}</div>
              {thesis.encadrant.bio && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-3">
                  {thesis.encadrant.bio}
                </p>
              )}
            </div>
          </div>

          <div className="border border-border rounded-md p-4 bg-surface">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Prochaine échéance
            </div>
            {nextDeadline ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Icon i="calendar" size={14} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {nextDeadline.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {formatDate(nextDeadline.dueAt)}
                </p>
                <button
                  type="button"
                  onClick={() => setCalendarOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary border border-primary py-2 rounded-sm"
                >
                  <Icon i="calendar-plus" size={12} />
                  Ajouter au calendrier
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Aucune échéance à venir.</p>
            )}
          </div>

          <div className="border border-border rounded-md p-4 bg-surface">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Fichiers récents
            </div>
            {recentDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun document déposé.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 border border-border rounded-sm hover:bg-input text-xs"
                  >
                    <Icon i="file-text" size={12} className="text-muted-foreground shrink-0" />
                    <span className="truncate text-muted-foreground">
                      {documentDisplayName(doc)}
                    </span>
                    <span className="text-muted-foreground/70 shrink-0">{documentFormat(doc)}</span>
                    <Icon
                      i="download"
                      size={11}
                      className="text-muted-foreground ml-auto shrink-0"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <button
              type="button"
              disabled
              title="Bientôt disponible"
              className="flex items-center gap-2 p-2.5 border border-border rounded-sm text-muted-foreground font-medium opacity-50 cursor-not-allowed"
            >
              <Icon i="bell-off" size={12} />
              Désactiver les notifications
            </button>
            <button
              type="button"
              disabled
              title="Bientôt disponible"
              className="flex items-center gap-2 p-2.5 border border-border rounded-sm text-muted-foreground font-medium opacity-50 cursor-not-allowed"
            >
              <Icon i="flag" size={12} />
              Signaler
            </button>
          </div>
        </div>
      </div>

      {calendarOpen && nextDeadline && (
        <AddToCalendarModal deadline={nextDeadline} onClose={() => setCalendarOpen(false)} />
      )}
    </div>
  );
}
