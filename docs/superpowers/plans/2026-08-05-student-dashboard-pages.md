# Pages étudiant (Documents/Commentaires/Calendrier) + dropdown de notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 3 inert student-nav items ("Documents", "Commentaires", "Calendrier") into real pages, and wire a working dropdown onto the previously-decorative notification bell — both changes apply everywhere `StudentNav` is rendered.

**Architecture:** `/documents`, `/comments`, `/deadlines` already exist as encadrant-only aggregate pages that redirect any `ETUDIANT` profile to `/dashboard`. Each gets an `ETUDIANT` branch (same pattern `/dashboard` already uses for `StudentDashboardContent`) that renders a new, single-thesis-scoped `Student*Content` component instead of redirecting. No new API routes: everything reads/writes the already-existing, already-tested per-thesis routes (`/api/theses/{id}/documents|comments|deadlines`) and the already-existing, already-tested `/api/notifications` (list + mark-read) and `/api/notifications/count`. `NotificationBell` is a new self-contained component (own open/closed state, own data fetching) swapped into `StudentNav`, which is the single shared nav shell for every student-facing screen.

**Tech Stack:** Next.js 16 App Router (client components), `useApi`/`api()` wrappers, Tailwind v4, `lucide-react` via the existing `Icon` component.

## Global Constraints

- No new API routes, no Prisma migration — every data need is already served by an existing, tested endpoint (verified during design: `resolveThesisAccess` gates the per-thesis routes by student-or-encadrant membership, not by `profileType`).
- UI copy is French, inlined in JSX — matches every existing screen in this codebase.
- No new test files — this codebase has zero `.test.tsx` files by established convention (React components are verified via `typecheck`/`lint` + manual dev-server check, not unit tests).
- Reuse existing components as-is where the spec calls for it: `StudentDocumentRow`, `StudentCommentItem`, `AddToCalendarModal`. Do not modify their prop signatures.
- `deadlineUrgencyBucket`/`daysUntil`/`relativeTime`/`formatDate`/`displayName` all already exist in `frontend/src/lib/theses.ts` — do not redefine them.
- Comments thread on the new student page is **flat** (no `parentId`/nested replies) — matches the spec's explicit scope decision.
- Calendrier page is **read-only** for the student — `POST /api/theses/[id]/deadlines` is `ENCADRANT_ONLY` server-side; do not add a creation form.
- `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build` must all pass before the final commit (CLAUDE.md's "before committing" gate) — run on the last task.

---

### Task 1: `NotificationBell` + wire it (and the 3 nav links) into `StudentNav`

**Files:**
- Create: `frontend/src/components/student/NotificationBell.tsx`
- Modify: `frontend/src/components/student/StudentNav.tsx` (full-file replacement — most of the file changes)

**Interfaces:**
- Produces: `NotificationBell` — no props, default export is **named** (`export function NotificationBell()`), imported from `@/components/student/NotificationBell` (actually `./NotificationBell` since both files live in the same directory).
- Produces: `StudentNavProps.active` widened to `'dashboard' | 'documents' | 'comments' | 'deadlines'` (still optional). Tasks 2-4 pass `active="documents"` / `active="comments"` / `active="deadlines"` respectively — this task MUST land first, or those tasks' new components won't typecheck against the old (`'dashboard'`-only) type.
- Consumes: `useApi` (`@/lib/useApi`), `api`/`ApiError` (`@/lib/api`), `useToast` (`@/contexts/ToastContext`), `relativeTime` (`@/lib/theses`), `Icon` (`@/components/ui/Icon`) — all pre-existing, all already used elsewhere in this codebase with these exact import paths and signatures.

`GET /api/notifications` already returns `{ items: [{ id, type, title, body, data, readAt, createdAt }], nextCursor }` (see `frontend/src/app/api/notifications/route.ts`). `PATCH /api/notifications` takes `{ ids: string[] | 'all' }` and returns `{ updated, unreadCount }`. Neither needs any change.

- [ ] **Step 1: Create `NotificationBell.tsx`**

Create `frontend/src/components/student/NotificationBell.tsx`:

```tsx
// Notification dropdown — was previously a purely decorative bell (badge
// count only, no click handler) in StudentNav. GET/PATCH /api/notifications
// already existed and were already tested but never consumed by any UI
// before this component.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useToast } from '@/contexts/ToastContext';
import { Icon } from '@/components/ui/Icon';
import { relativeTime } from '@/lib/theses';

interface NotificationCountResponse {
  count: number;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  nextCursor: string | null;
}

// Where a click on a notification of this type should navigate. Types with
// no entry here are marked read and the dropdown just closes — no page in
// this app's scope corresponds to them yet (e.g. DOCUMENT_SUBMITTED is only
// ever sent to an encadrant, who has no bell today; WITHDRAWAL_REQUESTED is
// unrelated to the thesis-tracking domain).
const TYPE_DESTINATION: Record<string, string> = {
  COMMENT_ADDED: '/comments',
  DEADLINE_ADDED: '/deadlines',
  MESSAGE_RECEIVED: '/messages',
  THESIS_ASSIGNED: '/dashboard',
};

export function NotificationBell() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: countRes, refresh: refreshCount } =
    useApi<NotificationCountResponse>('/api/notifications/count');
  const count = countRes?.count ?? 0;

  const {
    data: listRes,
    loading: listLoading,
    refresh: refreshList,
  } = useApi<NotificationsResponse>('/api/notifications?limit=10', { skip: !open });

  const items = listRes?.items ?? [];
  const hasUnread = items.some((n) => n.readAt === null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function markRead(ids: string[] | 'all') {
    try {
      await api('/api/notifications', { method: 'PATCH', body: { ids } });
      void refreshList();
      void refreshCount();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    }
  }

  function onNotificationClick(n: NotificationItem) {
    if (n.readAt === null) void markRead([n.id]);
    setOpen(false);
    const destination = TYPE_DESTINATION[n.type];
    if (destination) router.push(destination);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative w-8 h-8 rounded-sm border border-border bg-surface flex items-center justify-center"
      >
        <Icon i="bell" size={15} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface border border-border rounded-md shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {hasUnread && (
              <button
                type="button"
                onClick={() => void markRead('all')}
                className="text-xs font-medium text-primary"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {listLoading && !listRes ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Chargement…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Aucune notification.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onNotificationClick(n)}
                  className="w-full flex items-start gap-2 px-4 py-3 border-b border-border last:border-0 text-left hover:bg-input"
                >
                  {n.readAt === null && (
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <div className={`flex-1 min-w-0 ${n.readAt === null ? '' : 'pl-3.5'}`}>
                    <div className="text-xs font-semibold text-foreground truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {n.body}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {relativeTime(n.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `StudentNav.tsx` in full**

Open `frontend/src/components/student/StudentNav.tsx` and replace the **entire file contents** with:

```tsx
// Banani student screens (`Dashboard Étudiant`, `Dépôt de fichier étudiant`,
// `Messagerie étudiant-encadrant`, `Documents`, `Commentaires`,
// `Calendrier`) all share this exact top nav. "Documents"/"Commentaires"/
// "Calendrier" now link to real per-thesis pages (previously inert
// `Bientôt disponible` spans — see the 2026-08-05 student-dashboard-pages
// spec). The notification bell now opens a real dropdown via
// NotificationBell instead of only showing a static count badge.
'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from './NotificationBell';

interface StudentNavProps {
  name: string;
  active?: 'dashboard' | 'documents' | 'comments' | 'deadlines';
}

const NAV_LINKS: { id: 'documents' | 'comments' | 'deadlines'; href: string; label: string }[] = [
  { id: 'documents', href: '/documents', label: 'Documents' },
  { id: 'comments', href: '/comments', label: 'Commentaires' },
  { id: 'deadlines', href: '/deadlines', label: 'Calendrier' },
];

export function StudentNav({ name, active }: StudentNavProps) {
  return (
    <nav className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
      <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
          <Icon i="graduation-cap" size={14} className="text-primary-foreground" />
        </div>
        <span className="hidden sm:inline text-base font-semibold font-headings text-foreground">
          ThèseFacile
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-6 text-sm font-medium">
        <Link
          href="/dashboard"
          className={
            active === 'dashboard'
              ? 'text-primary border-b-2 border-primary pb-0.5'
              : 'text-muted-foreground'
          }
        >
          Mon mémoire
        </Link>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            className={
              active === link.id
                ? 'text-primary border-b-2 border-primary pb-0.5'
                : 'text-muted-foreground'
            }
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border">
          <Avatar name={name} className="h-8 w-8" />
          <div className="text-xs font-semibold text-foreground">{name}</div>
        </div>
      </div>
    </nav>
  );
}
```

Note: `StudentMessagingContent.tsx` and `StudentFileUploadForm.tsx` call `<StudentNav name={name} />` with no `active` prop at all — that still compiles fine since `active` stays optional.

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter frontend run typecheck`
Expected: no errors.

Run: `pnpm --filter frontend run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification on the dev server**

Run `pnpm dev` (or reuse a running instance). Log in as a student (`profileType: ETUDIANT`) with an assigned thesis, on `/dashboard`:
1. Confirm "Documents", "Commentaires", "Calendrier" are now clickable links (no longer greyed out with "Bientôt disponible"). Clicking them currently redirects back to `/dashboard` — expected until Tasks 2-4 land.
2. Click the bell. Confirm a dropdown opens showing recent notifications (or "Aucune notification.").
3. Click outside the dropdown — confirm it closes. Reopen it, press Escape — confirm it closes.
4. If any notification is unread, click it — confirm it navigates (e.g. a `MESSAGE_RECEIVED` notification should land on `/messages`) and the badge count decreases.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/student/NotificationBell.tsx frontend/src/components/student/StudentNav.tsx
git commit -m "feat(student-nav): wire a real notification dropdown and enable the 3 nav links

NotificationBell replaces the static badge-only bell with a real
dropdown (GET/PATCH /api/notifications, both pre-existing and already
tested, just never consumed by any UI before). StudentNav's
Documents/Commentaires/Calendrier links now point at real routes
instead of being inert — the pages themselves land in the next 3
tasks."
```

---

### Task 2: Student "Documents" page

**Files:**
- Create: `frontend/src/components/student/StudentDocumentsContent.tsx`
- Modify: `frontend/src/app/documents/page.tsx`

**Interfaces:**
- Consumes: `StudentNav` (Task 1, `active="documents"` now valid), `StudentDocumentRow` (pre-existing, unchanged — `{ doc: ThesisDocument, commented: boolean }`), `useApi` (`@/lib/useApi`).
- Produces: `StudentDocumentsContent({ name: string })`, default export from `@/components/student/StudentDocumentsContent` — consumed only by `documents/page.tsx` in this task.

- [ ] **Step 1: Create `StudentDocumentsContent.tsx`**

Create `frontend/src/components/student/StudentDocumentsContent.tsx`:

```tsx
// Student "Documents" page — full (unpaginated) version of the "Mes
// documents" card already embedded on StudentDashboardContent. Reuses
// StudentDocumentRow as-is; same `commented` derivation as the dashboard
// (a document with >=1 linked comment shows "Commenté").
'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { StudentNav } from './StudentNav';
import { StudentDocumentRow } from './StudentDocumentRow';
import type { ThesisDocument, ThesisListItem } from '@/lib/theses';

interface ThesesResponse {
  items: ThesisListItem[];
}

interface DocumentsResponse {
  items: ThesisDocument[];
}

interface CommentRow {
  document: { id: string } | null;
}

interface CommentsResponse {
  items: CommentRow[];
}

interface StudentDocumentsContentProps {
  name: string;
}

export function StudentDocumentsContent({ name }: StudentDocumentsContentProps) {
  const { data: thesesRes, loading: thesesLoading } = useApi<ThesesResponse>('/api/theses');
  const thesis = thesesRes?.items[0] ?? null;
  const thesisPath = thesis ? thesis.id : 'pending';

  const { data: docsRes } = useApi<DocumentsResponse>(`/api/theses/${thesisPath}/documents`, {
    skip: !thesis,
  });
  const { data: commentsRes } = useApi<CommentsResponse>(`/api/theses/${thesisPath}/comments`, {
    skip: !thesis,
  });

  const documents = useMemo(() => docsRes?.items ?? [], [docsRes]);

  const commentedDocIds = useMemo(() => {
    const ids = (commentsRes?.items ?? []).map((c) => c.document?.id).filter(Boolean);
    return new Set(ids);
  }, [commentsRes]);

  if (thesesLoading && !thesesRes) {
    return (
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="documents" />
        <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!thesis) {
    return (
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="documents" />
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
      <StudentNav name={name} active="documents" />
      <div className="px-4 py-6 sm:px-8">
        <div className="border border-border rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface">
            <div className="text-sm font-semibold font-headings text-foreground">
              Mes documents
            </div>
            <Link
              href="/documents/new"
              className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground bg-primary px-3 py-1.5 rounded-sm"
            >
              <Icon i="upload" size={12} />
              Déposer un fichier
            </Link>
          </div>
          {documents.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Aucun document déposé pour l&apos;instant.
            </p>
          ) : (
            documents.map((doc) => (
              <StudentDocumentRow
                key={doc.id}
                doc={doc}
                commented={commentedDocIds.has(doc.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `/documents/page.tsx`**

Open `frontend/src/app/documents/page.tsx`. Current line 20:

```tsx
import { DocumentRow } from '@/components/dashboard/DocumentRow';
```

Add directly below it:

```tsx
import { DocumentRow } from '@/components/dashboard/DocumentRow';
import { StudentDocumentsContent } from '@/components/student/StudentDocumentsContent';
```

Current lines 130-133:

```tsx
  if (profile.profileType === 'ETUDIANT') {
    router.replace('/dashboard');
    return null;
  }
```

Replace with:

```tsx
  if (profile.profileType === 'ETUDIANT') {
    const studentName = profile.name || user.email.split('@')[0] || user.email;
    return <StudentDocumentsContent name={studentName} />;
  }
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter frontend run typecheck`
Expected: no errors.

Run: `pnpm --filter frontend run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification on the dev server**

As a logged-in student with an assigned thesis:
1. Navigate to `/documents` (via the nav link or directly). Confirm it now shows "Mes documents" with the full list (not a redirect to `/dashboard`).
2. Confirm "Déposer un fichier" still opens `/documents/new` and a newly-deposited file shows up here after returning.
3. Confirm a document that has a linked comment shows "Commenté"; one without shows "En attente de retour" (matches the dashboard's existing embedded list).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/student/StudentDocumentsContent.tsx frontend/src/app/documents/page.tsx
git commit -m "feat(students): build the student Documents page

/documents now renders a real per-thesis document list for ETUDIANT
profiles instead of redirecting to /dashboard. Reuses the existing
StudentDocumentRow and the same commented-derivation logic already
used by the dashboard's embedded 'Mes documents' card."
```

---

### Task 3: Student "Commentaires" page (read + reply)

**Files:**
- Create: `frontend/src/components/student/StudentCommentsContent.tsx`
- Modify: `frontend/src/app/comments/page.tsx`

**Interfaces:**
- Consumes: `StudentNav` (Task 1, `active="comments"`), `StudentCommentItem` (pre-existing, unchanged — `{ comment: { id, body, resolved, createdAt, author: ThesisPerson, document: { chapter: string | null } | null } }`), `api`/`ApiError`, `useToast`, `useApi`.
- Produces: `StudentCommentsContent({ name: string })`, default export from `@/components/student/StudentCommentsContent` — consumed only by `comments/page.tsx` in this task.

- [ ] **Step 1: Create `StudentCommentsContent.tsx`**

Create `frontend/src/components/student/StudentCommentsContent.tsx`:

```tsx
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
            <div className="text-sm font-semibold font-headings text-foreground">
              Commentaires
            </div>
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
```

- [ ] **Step 2: Wire it into `/comments/page.tsx`**

Open `frontend/src/app/comments/page.tsx`. Current line 19:

```tsx
import { CommentThread } from '@/components/dashboard/CommentThread';
```

Add directly below it:

```tsx
import { CommentThread } from '@/components/dashboard/CommentThread';
import { StudentCommentsContent } from '@/components/student/StudentCommentsContent';
```

Current lines 139-142:

```tsx
  if (profile.profileType === 'ETUDIANT') {
    router.replace('/dashboard');
    return null;
  }
```

Replace with:

```tsx
  if (profile.profileType === 'ETUDIANT') {
    const studentName = profile.name || user.email.split('@')[0] || user.email;
    return <StudentCommentsContent name={studentName} />;
  }
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter frontend run typecheck`
Expected: no errors.

Run: `pnpm --filter frontend run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification on the dev server**

As a logged-in student with an assigned thesis:
1. Navigate to `/comments`. Confirm the full thread renders (not a redirect).
2. Type a message in the composer and send it. Confirm a success toast, the textarea clears, and the new message appears in the thread without a page reload.
3. As the encadrant (separate session/browser), open `/students/{thesisId}` and confirm the student's reply is visible there too (same underlying `Comment` rows).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/student/StudentCommentsContent.tsx frontend/src/app/comments/page.tsx
git commit -m "feat(students): build the student Commentaires page with reply support

/comments now renders the full comment thread for ETUDIANT profiles
(both sides, not just the encadrant's) plus a composer — POST
/api/theses/[id]/comments already allowed a student reply, only the UI
was missing."
```

---

### Task 4: Student "Calendrier" page

**Files:**
- Create: `frontend/src/components/student/StudentDeadlineCard.tsx`
- Create: `frontend/src/components/student/StudentCalendarContent.tsx`
- Modify: `frontend/src/app/deadlines/page.tsx`

**Interfaces:**
- Consumes: `StudentNav` (Task 1, `active="deadlines"`), `AddToCalendarModal` (pre-existing, unchanged — `{ deadline: ThesisDeadline, onClose: () => void }`), `deadlineUrgencyBucket`/`daysUntil`/`formatDate` (`@/lib/theses`, unchanged).
- Produces: `StudentDeadlineCard({ deadline: ThesisDeadline, daysLeft: number, bucket: DeadlineBucket })`, consumed by `StudentCalendarContent` in this same task. `StudentCalendarContent({ name: string })`, default export from `@/components/student/StudentCalendarContent` — consumed only by `deadlines/page.tsx` in this task.

- [ ] **Step 1: Create `StudentDeadlineCard.tsx`**

Create `frontend/src/components/student/StudentDeadlineCard.tsx`:

```tsx
// Simpler than the encadrant `DeadlineCard` (components/dashboard/) — that
// one expects a cross-thesis DeadlineListItem with a nested `thesis.student`
// and `thesis.stage` (for the avatar/name/stage shown when an encadrant
// browses deadlines across all their students). This one is already "my"
// deadline, on a plain ThesisDeadline — no such nesting exists to read from.
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AddToCalendarModal } from './AddToCalendarModal';
import { formatDate, type DeadlineBucket, type ThesisDeadline } from '@/lib/theses';

const URGENCY_CLASS: Record<DeadlineBucket, string> = {
  critical: 'border-danger bg-danger/5',
  urgent: 'border-warning bg-warning/5',
  upcoming: 'border-secondary bg-secondary/5',
  future: 'border-border bg-surface',
};

const URGENCY_BADGE: Record<DeadlineBucket, string> = {
  critical: 'bg-danger text-danger-foreground',
  urgent: 'bg-warning text-warning-foreground',
  upcoming: 'bg-secondary text-secondary-foreground',
  future: 'bg-muted text-muted-foreground',
};

interface StudentDeadlineCardProps {
  deadline: ThesisDeadline;
  daysLeft: number;
  bucket: DeadlineBucket;
}

export function StudentDeadlineCard({ deadline, daysLeft, bucket }: StudentDeadlineCardProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className={`flex items-start gap-4 p-4 border rounded-md ${URGENCY_CLASS[bucket]}`}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="font-medium text-sm text-foreground truncate">{deadline.title}</div>
            {deadline.description && (
              <div className="text-xs text-muted-foreground truncate">{deadline.description}</div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div
              className={`text-xs font-semibold px-2 py-1 rounded-sm whitespace-nowrap ${URGENCY_BADGE[bucket]}`}
            >
              {daysLeft > 0
                ? `${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
                : daysLeft === 0
                  ? "Aujourd'hui"
                  : `Retard: ${Math.abs(daysLeft)} j`}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDate(deadline.dueAt)}</span>
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="flex items-center gap-1 text-primary font-medium"
          >
            <Icon i="calendar-plus" size={12} />
            Ajouter au calendrier
          </button>
        </div>
      </div>

      {calendarOpen && (
        <AddToCalendarModal deadline={deadline} onClose={() => setCalendarOpen(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `StudentCalendarContent.tsx`**

Create `frontend/src/components/student/StudentCalendarContent.tsx`:

```tsx
// Student "Calendrier" page — read-only list of the student's own thesis
// deadlines, grouped by urgency (same 3 sections/order as the encadrant's
// cross-thesis /deadlines page). No creation form: POST
// /api/theses/[id]/deadlines is ENCADRANT_ONLY server-side.
'use client';

import { useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { StudentNav } from './StudentNav';
import { StudentDeadlineCard } from './StudentDeadlineCard';
import {
  daysUntil,
  deadlineUrgencyBucket,
  type DeadlineBucket,
  type ThesisDeadline,
  type ThesisListItem,
} from '@/lib/theses';

interface ThesesResponse {
  items: ThesisListItem[];
}

interface DeadlinesResponse {
  items: ThesisDeadline[];
}

const SECTIONS: {
  buckets: DeadlineBucket[];
  icon: string;
  label: string;
  headingClass: string;
  badgeClass: string;
  iconClass: string;
}[] = [
  {
    buckets: ['critical'],
    icon: 'alert-triangle',
    label: 'En retard',
    headingClass: 'text-danger',
    badgeClass: 'text-danger bg-danger/10',
    iconClass: 'text-danger',
  },
  {
    buckets: ['urgent'],
    icon: 'clock',
    label: 'Urgent',
    headingClass: 'text-warning',
    badgeClass: 'text-warning bg-warning/10',
    iconClass: 'text-warning',
  },
  {
    buckets: ['upcoming', 'future'],
    icon: 'calendar',
    label: 'À venir',
    headingClass: 'text-foreground',
    badgeClass: 'text-secondary-foreground bg-secondary',
    iconClass: 'text-secondary-foreground',
  },
];

interface StudentCalendarContentProps {
  name: string;
}

export function StudentCalendarContent({ name }: StudentCalendarContentProps) {
  const { data: thesesRes, loading: thesesLoading } = useApi<ThesesResponse>('/api/theses');
  const thesis = thesesRes?.items[0] ?? null;
  const thesisPath = thesis ? thesis.id : 'pending';

  const { data: deadlinesRes } = useApi<DeadlinesResponse>(
    `/api/theses/${thesisPath}/deadlines`,
    { skip: !thesis },
  );

  const withBucket = useMemo(() => {
    const items = deadlinesRes?.items ?? [];
    return items.map((deadline) => ({
      deadline,
      daysLeft: daysUntil(deadline.dueAt),
      bucket: deadlineUrgencyBucket(deadline.dueAt),
    }));
  }, [deadlinesRes]);

  if (thesesLoading && !thesesRes) {
    return (
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="deadlines" />
        <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!thesis) {
    return (
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="deadlines" />
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
      <StudentNav name={name} active="deadlines" />
      <div className="px-4 py-6 sm:px-8">
        {withBucket.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-8 text-center">
            <p className="text-sm text-muted-foreground">Aucune échéance à venir.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {SECTIONS.map((section) => {
              const rows = withBucket.filter((row) => section.buckets.includes(row.bucket));
              if (rows.length === 0) return null;
              return (
                <div key={section.label}>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                    <Icon i={section.icon} size={16} className={section.iconClass} />
                    <h3 className={`text-sm font-semibold font-headings ${section.headingClass}`}>
                      {section.label}
                    </h3>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-sm ${section.badgeClass}`}
                    >
                      {rows.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {rows.map(({ deadline, daysLeft, bucket }) => (
                      <StudentDeadlineCard
                        key={deadline.id}
                        deadline={deadline}
                        daysLeft={daysLeft}
                        bucket={bucket}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `/deadlines/page.tsx`**

Open `frontend/src/app/deadlines/page.tsx`. Current line 21:

```tsx
import { AddDeadlineForm } from '@/components/dashboard/AddDeadlineForm';
```

Add directly below it:

```tsx
import { AddDeadlineForm } from '@/components/dashboard/AddDeadlineForm';
import { StudentCalendarContent } from '@/components/student/StudentCalendarContent';
```

Current lines 168-171:

```tsx
  if (profile.profileType === 'ETUDIANT') {
    router.replace('/dashboard');
    return null;
  }
```

Replace with:

```tsx
  if (profile.profileType === 'ETUDIANT') {
    const studentName = profile.name || user.email.split('@')[0] || user.email;
    return <StudentCalendarContent name={studentName} />;
  }
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter frontend run typecheck`
Expected: no errors.

Run: `pnpm --filter frontend run lint`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm --filter frontend run test`
Expected: all tests pass (same count as before this plan — no new `.test.ts` files were added by this plan, per the Global Constraints note on zero component tests).

- [ ] **Step 6: Manual verification on the dev server**

As a logged-in student with an assigned thesis that has at least one deadline (ask the encadrant to add one via `/deadlines` → "Ajouter une échéance" if none exist):
1. Navigate to `/deadlines`. Confirm the sections (En retard/Urgent/À venir) render with the right deadlines in each, matching the encadrant's own grouping for the same data.
2. Click "Ajouter au calendrier" on a deadline — confirm `AddToCalendarModal` opens and downloading produces a `.ics` file (same modal already used elsewhere, unmodified).
3. Confirm there is no "Ajouter une échéance" button anywhere on this student view.
4. Re-check `/documents` and `/comments` still work (Tasks 2-3 regressions).
5. Click the bell on all 3 new pages plus `/dashboard`, `/documents/new`, `/messages` — confirm the dropdown opens and closes correctly everywhere (full "toutes les pages qui le contiennent" coverage).

- [ ] **Step 7: Full pre-commit gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all green, per CLAUDE.md's "Before committing" requirement.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/student/StudentDeadlineCard.tsx frontend/src/components/student/StudentCalendarContent.tsx frontend/src/app/deadlines/page.tsx
git commit -m "feat(students): build the student Calendrier page

/deadlines now renders a read-only, urgency-grouped list of the
student's own thesis deadlines for ETUDIANT profiles, with a
per-deadline 'Ajouter au calendrier' (.ics export via the existing
AddToCalendarModal). Creation stays encadrant-only, matching the
already-enforced server-side guard."
```

---

## Self-Review Notes

- **Spec coverage:** all 4 spec sections are implemented — routing reuses `/documents`/`/comments`/`/deadlines` with an `ETUDIANT` branch exactly as decided (Tasks 2-4); Commentaires is read+reply, flat thread (Task 3); Calendrier is read-only, grouped by urgency, `.ics` export via the existing modal (Task 4); the notification dropdown covers every page rendering `StudentNav` because `StudentNav` itself is the single edited file (Task 1) — verified during design that `DashboardShell` (encadrant nav) has no bell to touch, so no encadrant-side change is in scope, matching the spec's explicit exclusion.
- **Ordering fix:** Task 1 (StudentNav's widened `active` prop type) intentionally precedes Tasks 2-4, which each pass a new `active` value (`"documents"`/`"comments"`/`"deadlines"`) that would fail to typecheck against the pre-Task-1 `StudentNavProps`.
- **Placeholder scan:** none — every step has literal, complete code (no `TBD`, no "add appropriate handling", no truncated components).
- **Type consistency:** `StudentNavProps.active` defined in Task 1 as `'dashboard' | 'documents' | 'comments' | 'deadlines'`, consumed with matching literal values in Tasks 2/3/4. `StudentDeadlineCardProps` (Task 4 Step 1) matches exactly how `StudentCalendarContent` (Task 4 Step 2) calls it (`deadline`, `daysLeft`, `bucket`). `CommentRow` shape in Task 3 matches `StudentCommentItemProps.comment` exactly (verified against the existing, unmodified `StudentCommentItem.tsx`). `NotificationBell` (Task 1) has no props and is imported the same way (`from './NotificationBell'`) as it's exported (named export, same file name).
