// Messagerie — Côté Encadrant — Banani `new_screen7.jsx`.
//
// Wrapped in the existing DashboardShell/Sidebar chrome (not Banani's own
// top nav for this screen) for consistency with every other encadrant page.
// See .planning/banani/phase-11-encadrant-messaging.md for every field-scope
// decision (GET /api/messages aggregate, unread derived from notifications,
// "chapitre actif" as a derived proxy, quick-actions as text-template
// inserts rather than new backend concepts).
'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { AddToCalendarModal } from '@/components/student/AddToCalendarModal';
import {
  displayName,
  documentDisplayName,
  formatDate,
  relativeTime,
  type ThesisDeadline,
  type ThesisDocument,
  type ThesisPerson,
} from '@/lib/theses';

interface InboxThesis {
  id: string;
  topic: string;
  progress: number;
  student: ThesisPerson;
}

interface InboxMessage {
  id: string;
  body: string;
  senderId: string;
  attachmentUrl: string | null;
  attachmentFilename: string | null;
  attachmentMimeType: string | null;
  createdAt: string;
}

interface InboxItem {
  thesis: InboxThesis;
  lastMessage: InboxMessage | null;
  unreadCount: number;
  unreadNotificationIds: string[];
  nextDeadline: ThesisDeadline | null;
  recentDocuments: ThesisDocument[];
}

interface InboxResponse {
  items: InboxItem[];
}

interface ThreadMessage {
  id: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  attachmentFilename: string | null;
  attachmentMimeType: string | null;
  createdAt: string;
}

interface ThreadResponse {
  items: ThreadMessage[];
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

const POLL_INTERVAL_MS = 5000;

interface EncadrantMessagingContentProps {
  name: string;
}

export function EncadrantMessagingContent({ name }: EncadrantMessagingContentProps) {
  const user = useUser();
  const [search, setSearch] = useState('');
  const [activeThesisId, setActiveThesisId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    data: inboxRes,
    loading: inboxLoading,
    refresh: refreshInbox,
  } = useApi<InboxResponse>('/api/messages');
  const items = useMemo(() => inboxRes?.items ?? [], [inboxRes]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return bt - at;
      }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter(
      (i) =>
        displayName(i.thesis.student).toLowerCase().includes(q) ||
        i.thesis.topic.toLowerCase().includes(q),
    );
  }, [sortedItems, search]);

  useEffect(() => {
    if (!activeThesisId && sortedItems.length > 0) {
      setActiveThesisId(sortedItems[0]!.thesis.id);
    }
  }, [activeThesisId, sortedItems]);

  const activeItem = items.find((i) => i.thesis.id === activeThesisId) ?? null;
  const chapitreActif = activeItem?.recentDocuments[0]?.chapter ?? null;

  const threadPath = `/api/theses/${activeThesisId ?? 'pending'}/messages`;
  const { data: threadRes, refresh: refreshThread } = useApi<ThreadResponse>(threadPath, {
    skip: !activeThesisId,
  });
  const threadMessages = threadRes?.items ?? [];

  useEffect(() => {
    if (!activeThesisId) return;
    const interval = setInterval(() => void refreshThread(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeThesisId, refreshThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [threadMessages.length]);

  // Mark this conversation's unread MESSAGE_RECEIVED notifications read once opened.
  useEffect(() => {
    if (!activeItem || activeItem.unreadNotificationIds.length === 0) return;
    void api('/api/notifications', {
      method: 'PATCH',
      body: { ids: activeItem.unreadNotificationIds },
    }).then(() => void refreshInbox());
    // Only re-run when the active conversation itself changes, not on every
    // inbox refresh (which would re-derive a new activeItem reference).
  }, [activeThesisId]);

  function selectThesis(thesisId: string) {
    setActiveThesisId(thesisId);
    setMobileView('thread');
    setDraft('');
    setPendingAttachment(null);
    setError(null);
  }

  function insertTemplate(text: string) {
    setDraft((prev) => (prev ? `${prev} ${text}` : text));
  }

  async function onAttachmentSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
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
    if ((!body && !pendingAttachment) || !activeThesisId) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/theses/${activeThesisId}/messages`, {
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
      await refreshThread();
      void refreshInbox();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSending(false);
    }
  }

  return (
    <DashboardShell
      name={name}
      header={<DashboardHeader eyebrow="Communication" title="Messages" />}
    >
      <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8">
        {inboxLoading && items.length === 0 ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-80 shrink-0 border border-border rounded-md overflow-hidden bg-surface flex flex-col">
              <div className="px-4 py-3 border-b border-border">
                <Skeleton className="h-8 w-full" />
              </div>
              <div className="flex flex-col">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-b-0"
                  >
                    <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                    <div className="flex-1 flex flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:flex flex-1 min-w-0 border border-border rounded-md overflow-hidden bg-background flex-col">
              <div className="flex items-center gap-3 px-6 py-4 bg-surface border-b border-border">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-4 px-6 py-6">
                <div className="flex gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <Skeleton className="h-10 w-48" />
                </div>
                <div className="flex gap-3 flex-row-reverse">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <Skeleton className="h-10 w-40" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <Skeleton className="h-10 w-56" />
                </div>
              </div>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-8 text-center motion-safe:animate-fade-in">
            <p className="text-sm text-muted-foreground">
              Aucun étudiant pour l&apos;instant — ajoutez-en un pour commencer à échanger.
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Conversation list */}
            <div
              className={`w-full lg:w-80 shrink-0 border border-border rounded-md overflow-hidden bg-surface flex-col ${
                mobileView === 'thread' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="border border-border rounded-sm px-3 py-2 bg-input flex items-center gap-2 transition-colors duration-150 focus-within:border-primary">
                  <Icon i="search" size={14} className="text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher…"
                    className="flex-1 text-sm bg-transparent outline-none text-foreground"
                  />
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto flex flex-col">
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 px-4 motion-safe:animate-fade-in">
                    Aucun résultat.
                  </p>
                ) : (
                  filteredItems.map((item) => {
                    const isActive = item.thesis.id === activeThesisId;
                    return (
                      <button
                        key={item.thesis.id}
                        type="button"
                        onClick={() => selectThesis(item.thesis.id)}
                        className={`flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-b-0 text-left transition-colors duration-150 ${
                          isActive ? 'bg-secondary' : 'hover:bg-input'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Avatar
                            name={displayName(item.thesis.student)}
                            src={item.thesis.student.avatarUrl}
                            className="h-9 w-9"
                          />
                          {item.unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
                              {item.unreadCount > 9 ? '9+' : item.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5 gap-2">
                            <span
                              className={`text-sm font-semibold truncate ${
                                isActive ? 'text-secondary-foreground' : 'text-foreground'
                              }`}
                            >
                              {displayName(item.thesis.student)}
                            </span>
                            {item.lastMessage && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {relativeTime(item.lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate mb-0.5">
                            {item.thesis.topic}
                          </div>
                          {item.lastMessage && (
                            <div className="text-xs text-muted-foreground truncate">
                              {item.lastMessage.body || '📎 Pièce jointe'}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Thread */}
            {activeItem ? (
              <div
                className={`flex-1 min-w-0 border border-border rounded-md overflow-hidden bg-background flex-col ${
                  mobileView === 'list' ? 'hidden lg:flex' : 'flex'
                }`}
              >
                <div className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border gap-2 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="lg:hidden text-muted-foreground shrink-0 transition duration-150 hover:text-foreground motion-safe:active:scale-90"
                      aria-label="Retour aux conversations"
                    >
                      <Icon i="chevron-right" size={18} className="rotate-180" />
                    </button>
                    <Avatar
                      name={displayName(activeItem.thesis.student)}
                      src={activeItem.thesis.student.avatarUrl}
                      className="h-10 w-10"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {displayName(activeItem.thesis.student)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {activeItem.thesis.student.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/documents?studentId=${activeItem.thesis.student.id}`}
                      className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border px-3 py-1.5 rounded-sm transition-colors duration-150 hover:bg-input"
                    >
                      <Icon i="file-text" size={12} />
                      Voir les documents
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(true)}
                      disabled={!activeItem.nextDeadline}
                      title={activeItem.nextDeadline ? undefined : 'Aucune échéance à venir'}
                      className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border px-3 py-1.5 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 hover:bg-input"
                    >
                      <Icon i="calendar" size={12} />
                      Planifier une réunion
                    </button>
                  </div>
                </div>

                <div
                  ref={scrollRef}
                  className="max-h-[45vh] overflow-y-auto flex flex-col gap-4 px-6 py-6"
                >
                  {threadMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8 motion-safe:animate-fade-in">
                      Aucun message pour l&apos;instant.
                    </p>
                  ) : (
                    threadMessages.map((msg) => {
                      const isOwn = msg.senderId === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                        >
                          <Avatar
                            name={isOwn ? name : displayName(activeItem.thesis.student)}
                            src={isOwn ? null : activeItem.thesis.student.avatarUrl}
                            className="h-8 w-8 shrink-0"
                          />
                          <div
                            className={`flex flex-col gap-1 max-w-lg ${isOwn ? 'items-end' : ''}`}
                          >
                            <div
                              className={`overflow-hidden rounded-md ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-input text-foreground'
                              }`}
                            >
                              {msg.attachmentUrl &&
                                msg.attachmentMimeType?.startsWith('image/') && (
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

                <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={attaching}
                    onClick={() => attachmentInputRef.current?.click()}
                    className="text-xs font-medium text-secondary-foreground bg-secondary border border-secondary px-3 py-1.5 rounded-sm transition duration-150 hover:bg-secondary/70 disabled:opacity-50 motion-safe:active:scale-[0.97]"
                  >
                    📎 Joindre un fichier
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertTemplate(
                        'Pourriez-vous me proposer 2-3 créneaux cette semaine pour faire le point ?',
                      )
                    }
                    className="text-xs font-medium text-secondary-foreground bg-secondary border border-secondary px-3 py-1.5 rounded-sm transition duration-150 hover:bg-secondary/70 motion-safe:active:scale-[0.97]"
                  >
                    📅 Proposer un rendez-vous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertTemplate(
                        `Après relecture, ${chapitreActif ? `le ${chapitreActif}` : 'ce chapitre'} est validé — vous pouvez poursuivre sur la suite.`,
                      )
                    }
                    className="text-xs font-medium text-secondary-foreground bg-secondary border border-secondary px-3 py-1.5 rounded-sm transition duration-150 hover:bg-secondary/70 motion-safe:active:scale-[0.97]"
                  >
                    ✓ Valider un chapitre
                  </button>
                </div>

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
                        placeholder={`Votre message à ${displayName(activeItem.thesis.student)}…`}
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
              </div>
            ) : (
              <div className="flex-1 hidden lg:flex items-center justify-center border border-dashed border-border rounded-md">
                <p className="text-sm text-muted-foreground">Sélectionnez une conversation.</p>
              </div>
            )}

            {/* Right — student context */}
            {activeItem && (
              <div className="hidden xl:flex w-64 shrink-0 flex-col gap-4">
                <div className="border border-border rounded-md p-4 bg-surface">
                  <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                    Contexte étudiant
                  </div>
                  <div className="flex flex-col items-center text-center gap-2 mb-3">
                    <Avatar
                      name={displayName(activeItem.thesis.student)}
                      src={activeItem.thesis.student.avatarUrl}
                      className="h-14 w-14"
                    />
                    <div className="text-sm font-semibold text-foreground">
                      {displayName(activeItem.thesis.student)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground italic leading-relaxed text-center">
                    « {activeItem.thesis.topic} »
                  </div>
                </div>

                <div className="border border-border rounded-md p-4 bg-surface">
                  <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                    Avancement
                  </div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Global</span>
                    <span className="font-semibold text-foreground">
                      {activeItem.thesis.progress}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
                      style={{ width: `${activeItem.thesis.progress}%` }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs">
                    {chapitreActif && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Chapitre actif</span>
                        <span className="font-medium text-foreground">{chapitreActif}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Prochaine échéance</span>
                      <span className="font-medium text-warning-foreground">
                        {activeItem.nextDeadline
                          ? formatDate(activeItem.nextDeadline.dueAt)
                          : 'Aucune'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-md p-4 bg-surface">
                  <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                    Derniers documents
                  </div>
                  {activeItem.recentDocuments.length === 0 ? (
                    <p className="text-xs text-muted-foreground motion-safe:animate-fade-in">
                      Aucun document déposé.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {activeItem.recentDocuments.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Icon i="file-text" size={12} className="shrink-0" />
                          <span className="truncate">{documentDisplayName(doc)}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-border rounded-md p-4 bg-surface">
                  <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                    Actions rapides
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/comments?studentId=${activeItem.thesis.student.id}`}
                      className="flex items-center gap-2 text-xs font-medium text-foreground border border-border rounded-sm px-2.5 py-2 transition-colors duration-150 hover:bg-input"
                    >
                      <Icon i="message-square" size={12} />
                      Ajouter un commentaire
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(true)}
                      disabled={!activeItem.nextDeadline}
                      className="flex items-center gap-2 text-xs font-medium text-foreground border border-border rounded-sm px-2.5 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 hover:bg-input"
                    >
                      <Icon i="calendar-plus" size={12} />
                      Planifier une réunion
                    </button>
                    <Link
                      href={`/students/${activeItem.thesis.id}`}
                      className="flex items-center gap-2 text-xs font-medium text-foreground border border-border rounded-sm px-2.5 py-2 transition-colors duration-150 hover:bg-input"
                    >
                      <Icon i="user" size={12} />
                      Voir le profil complet
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {calendarOpen && activeItem?.nextDeadline && (
        <AddToCalendarModal
          deadline={activeItem.nextDeadline}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="Pièce jointe" onClose={() => setLightboxUrl(null)} />
      )}
    </DashboardShell>
  );
}
