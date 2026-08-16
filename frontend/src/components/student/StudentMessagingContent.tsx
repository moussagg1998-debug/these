// Messagerie étudiant-encadrant — Banani `StudentMessaging.jsx`.
//
// See .planning/banani/phase-9-student-messaging.md for every field-scope
// decision (no Meeting model → "Prochaine échéance" reuses the real next
// Deadline, fabricated availability/location/title dropped, "Fichiers
// récents" reuses real documents, notifications/report stay inert).
'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { StudentShell } from './StudentShell';
import { AddToCalendarModal } from './AddToCalendarModal';
import { ThesisBlockedBanner } from './ThesisBlockedBanner';
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
  attachmentUrl: string | null;
  attachmentFilename: string | null;
  attachmentMimeType: string | null;
  createdAt: string;
}

interface PendingAttachment {
  url: string;
  filename: string;
  mimeType: string;
}

const ATTACHMENT_ERROR_MESSAGES: Record<string, string> = {
  FILE_TOO_LARGE: 'Fichier trop volumineux.',
  INVALID_MIME: 'Format non supporté — utilisez une image JPEG, PNG ou WebP.',
  MAGIC_BYTE_MISMATCH: 'Le fichier ne correspond pas au format déclaré.',
  STORAGE_NOT_CONFIGURED: "Le stockage d'images n'est pas configuré.",
};

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
  const blocked = thesis.stage === 'Bloqué';
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messagesRes, refresh: refreshMessages } = useApi<MessagesResponse>(
    `/api/theses/${thesis.id}/messages`,
  );
  const { data: deadlinesRes } = useApi<DeadlinesResponse>(`/api/theses/${thesis.id}/deadlines`);
  const { data: docsRes } = useApi<DocumentsResponse>(`/api/theses/${thesis.id}/documents`);

  const messages = useMemo(() => messagesRes?.items ?? [], [messagesRes]);
  // A deadline the encadrant has validated ("respectée") frees up this slot
  // for whichever deadline is next.
  const nextDeadline = useMemo(
    () => deadlinesRes?.items.find((d) => !d.completedAt) ?? null,
    [deadlinesRes],
  );
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

  async function onAttachmentSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || blocked) return;
    setAttaching(true);
    setError(null);
    try {
      const uploaded = await uploadFile(file);
      setPendingAttachment({ url: uploaded.url, filename: file.name, mimeType: uploaded.mimeType });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ATTACHMENT_ERROR_MESSAGES[err.code] ?? err.message)
          : 'Une erreur est survenue.',
      );
    } finally {
      setAttaching(false);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if ((!body && !pendingAttachment) || blocked) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/theses/${thesis.id}/messages`, {
        method: 'POST',
        body: {
          body,
          ...(pendingAttachment
            ? {
                attachmentUrl: pendingAttachment.url,
                attachmentFilename: pendingAttachment.filename,
                attachmentMimeType: pendingAttachment.mimeType,
              }
            : {}),
        },
      });
      setDraft('');
      setPendingAttachment(null);
      await refreshMessages();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'THESIS_BLOCKED') {
        setError(
          'Votre encadrant a bloqué votre mémoire — vous ne pouvez plus envoyer de message.',
        );
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <StudentShell name={name}>
      <div className="flex flex-col lg:flex-row px-4 py-6 sm:px-8 gap-6">
        {/* LEFT — conversation */}
        <div className="flex-1 flex flex-col min-w-0 border border-border rounded-md bg-background overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar
                name={displayName(thesis.encadrant)}
                src={thesis.encadrant.avatarUrl}
                className="h-10 w-10"
              />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {displayName(thesis.encadrant)}
                </div>
                <div className="text-xs text-muted-foreground">{thesis.encadrant.email}</div>
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 flex flex-col gap-4 px-6 py-6 overflow-y-auto max-h-[60vh]"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 motion-safe:animate-fade-in">
                Aucun message pour l&apos;instant — envoyez le premier message à votre encadrant.
              </p>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <Avatar
                      name={isOwn ? name : displayName(thesis.encadrant)}
                      src={isOwn ? null : thesis.encadrant.avatarUrl}
                      className="h-8 w-8 shrink-0"
                    />
                    <div className={`flex flex-col gap-1 max-w-sm ${isOwn ? 'items-end' : ''}`}>
                      <div
                        className={`overflow-hidden rounded-md ${
                          isOwn ? 'bg-primary text-primary-foreground' : 'bg-input text-foreground'
                        }`}
                      >
                        {msg.attachmentUrl && msg.attachmentMimeType?.startsWith('image/') && (
                          <button
                            type="button"
                            onClick={() => setLightboxUrl(msg.attachmentUrl)}
                            className="block w-full"
                          >
                            <img
                              src={msg.attachmentUrl}
                              alt={msg.attachmentFilename ?? 'Pièce jointe'}
                              className="max-h-60 w-full object-cover"
                            />
                          </button>
                        )}
                        {msg.body && (
                          <p className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.body}
                          </p>
                        )}
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

          {blocked ? (
            <div className="border-t border-border px-6 py-4 bg-surface">
              <ThesisBlockedBanner />
            </div>
          ) : (
            <form onSubmit={onSend} className="border-t border-border px-6 py-4 bg-surface">
              {error && (
                <p role="alert" className="text-xs text-danger mb-2">
                  {error}
                </p>
              )}
              {pendingAttachment && (
                <div className="mb-2 flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-1.5 text-xs text-foreground">
                  <Icon i="paperclip" size={12} className="shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{pendingAttachment.filename}</span>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    aria-label="Retirer la pièce jointe"
                    className="shrink-0 text-muted-foreground transition duration-150 hover:text-foreground motion-safe:active:scale-90"
                  >
                    <Icon i="x" size={12} />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-3">
                <div className="flex-1 flex items-center gap-2 border border-border rounded-md px-3 py-2.5 bg-input transition-colors duration-150 focus-within:border-primary">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Votre message…"
                    className="flex-1 text-sm text-foreground bg-transparent outline-none"
                  />
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => void onAttachmentSelected(e)}
                  />
                  <button
                    type="button"
                    disabled={attaching}
                    onClick={() => attachmentInputRef.current?.click()}
                    className="text-muted-foreground transition duration-150 hover:text-foreground disabled:opacity-50 motion-safe:active:scale-90"
                  >
                    <Icon
                      i={attaching ? 'loader' : 'paperclip'}
                      size={16}
                      className={attaching ? 'animate-spin' : undefined}
                    />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={sending || (!draft.trim() && !pendingAttachment)}
                  className="w-9 h-9 bg-primary text-primary-foreground rounded-sm flex items-center justify-center shrink-0 disabled:opacity-50 transition duration-150 motion-safe:active:scale-[0.98]"
                >
                  <Icon i="send" size={16} />
                </button>
              </div>
            </form>
          )}
        </div>

        {/* RIGHT sidebar */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
          <div className="border border-border rounded-md p-5 bg-surface">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              Profil
            </div>
            <div className="flex flex-col items-center text-center mb-4">
              <Avatar
                name={displayName(thesis.encadrant)}
                src={thesis.encadrant.avatarUrl}
                className="h-16 w-16 mb-3"
              />
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
              <p className="text-xs text-muted-foreground motion-safe:animate-fade-in">
                Aucune échéance à venir.
              </p>
            )}
          </div>

          <div className="border border-border rounded-md p-4 bg-surface">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Fichiers récents
            </div>
            {recentDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground motion-safe:animate-fade-in">
                Aucun document déposé.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 border border-border rounded-sm hover:bg-input text-xs transition-colors duration-150"
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
            <Tooltip label="Bientôt disponible" className="w-full">
              <button
                type="button"
                disabled
                className="w-full flex items-center gap-2 p-2.5 border border-border rounded-sm text-muted-foreground font-medium opacity-50 cursor-not-allowed"
              >
                <Icon i="bell-off" size={12} />
                Désactiver les notifications
              </button>
            </Tooltip>
            <Tooltip label="Bientôt disponible" className="w-full">
              <button
                type="button"
                disabled
                className="w-full flex items-center gap-2 p-2.5 border border-border rounded-sm text-muted-foreground font-medium opacity-50 cursor-not-allowed"
              >
                <Icon i="flag" size={12} />
                Signaler
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {calendarOpen && nextDeadline && (
        <AddToCalendarModal deadline={nextDeadline} onClose={() => setCalendarOpen(false)} />
      )}

      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="Pièce jointe" onClose={() => setLightboxUrl(null)} />
      )}
    </StudentShell>
  );
}
