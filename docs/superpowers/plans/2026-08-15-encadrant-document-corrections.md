# Envoi de fichiers de l'encadrant vers l'étudiant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the encadrant reply to a specific student document deposit with a correction file, notifying the student, without disturbing the existing student-deposit flow.

**Architecture:** One new nullable self-relation field on the existing `Document` model (`replyToDocumentId`) distinguishes an encadrant correction from a student deposit — no new table, no separate sender field. The existing `POST /api/theses/[id]/documents` route grows a second branch for the encadrant actor; both GET routes need no changes since they already return every `Document` on a thesis unfiltered by sender. A new `SendCorrectionModal` component (modeled on the existing `UpgradeModal`) reuses the same upload plumbing (`uploadFile()` → `/api/upload` → POST) as the student's `StudentFileUploadForm`.

**Tech Stack:** Next.js 16 App Router Route Handlers, Prisma 5 / Neon Postgres, Zod, Vitest, React 19 (client components), Tailwind v4.

Spec: `docs/superpowers/specs/2026-08-15-encadrant-document-corrections-design.md`

## Global Constraints

- Every Route Handler keeps `export const runtime = 'nodejs'` (already present on the touched route — do not remove).
- Notifications MUST go through `createNotification(prisma, input)` — never `prisma.notification.create` directly. Every notification's `dedupeKey` must be deterministic per logical event (no timestamp/random suffix).
- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` — no `any` casts, no silencing.
- Schema changes are applied with `pnpm db:push` (this repo's established convention — see `docs/superpowers/plans/2026-08-14-coupon-system.md`'s Task 1 note; no versioned migration folder is maintained for feature work).
- This repo has **no component test infrastructure** (confirmed: zero `*.test.tsx` files exist anywhere). UI tasks (SendCorrectionModal, DocumentRow, StudentDocumentRow) are implementation + manual `pnpm dev` QA only — do not attempt to add a `.test.tsx` file.
- Before considering any task done: `pnpm format && pnpm lint && pnpm typecheck && pnpm test` must all pass.
- This dev environment has been observed to have slow/flaky connectivity to the Neon database (multi-second query latency, occasional pool-timeout errors) — if `pnpm db:push` or `pnpm test` (which hits mocks, not the real DB, so should be unaffected) or a manual `pnpm dev` QA request times out, retry once before treating it as a real failure.

---

### Task 1: Schema — `Document.replyToDocumentId` self-relation

**Files:**
- Modify: `frontend/prisma/schema.prisma`

**Interfaces:**
- Produces: `Document.replyToDocumentId: string | null` (Prisma-generated client field), self-relation `Document.replyTo` / `Document.replies`. Every later task that reads or writes a `Document` row relies on this field existing on the Prisma Client type.

- [ ] **Step 1: Add the field to the `Document` model**

Find this block (currently around line 594-618 of `frontend/prisma/schema.prisma`):

```prisma
model Document {
  id          String    @id @default(cuid())
  thesisId    String
  thesis      Thesis    @relation(fields: [thesisId], references: [id], onDelete: Cascade)
  chapter     String? // e.g. "Chapitre 3"
  // Cloudinary URL — produced by the existing /api/upload flow, not a new
  // storage path. See CLAUDE.md "Files Claude SHOULD modify" — upload/sniff.ts.
  fileUrl     String
  // Both optional: Cloudinary's upload response carries `original_filename`/
  // `bytes`, populated by the student upload flow (Phase 8) — older rows
  // (or any created another way) fall back to deriving a display name from
  // `chapter`/`fileUrl` and omitting size when these are null.
  fileName    String?
  sizeBytes   Int?
  uploadedAt  DateTime  @default(now())
  // "Programmer le dépôt" — file is uploaded to storage immediately, but the
  // Document only becomes visible to the encadrant (and DOCUMENT_SUBMITTED
  // fires) once the scheduled-deposits cron releases it at this time. Null
  // means an ordinary, immediately-visible deposit — the common case.
  scheduledAt DateTime?
  comments    Comment[]

  @@index([thesisId, uploadedAt])
  @@index([scheduledAt])
}
```

Replace it with:

```prisma
model Document {
  id          String    @id @default(cuid())
  thesisId    String
  thesis      Thesis    @relation(fields: [thesisId], references: [id], onDelete: Cascade)
  chapter     String? // e.g. "Chapitre 3"
  // Cloudinary URL — produced by the existing /api/upload flow, not a new
  // storage path. See CLAUDE.md "Files Claude SHOULD modify" — upload/sniff.ts.
  fileUrl     String
  // Both optional: Cloudinary's upload response carries `original_filename`/
  // `bytes`, populated by the student upload flow (Phase 8) — older rows
  // (or any created another way) fall back to deriving a display name from
  // `chapter`/`fileUrl` and omitting size when these are null.
  fileName    String?
  sizeBytes   Int?
  uploadedAt  DateTime  @default(now())
  // "Programmer le dépôt" — file is uploaded to storage immediately, but the
  // Document only becomes visible to the encadrant (and DOCUMENT_SUBMITTED
  // fires) once the scheduled-deposits cron releases it at this time. Null
  // means an ordinary, immediately-visible deposit — the common case.
  scheduledAt DateTime?
  // Set only on an encadrant-authored correction — points at the student
  // deposit it replies to. Null = ordinary student deposit (the only kind
  // that existed before this field, so no backfill is needed). This field,
  // not a separate "author" field, is what distinguishes who sent a
  // Document row — see docs/superpowers/specs/
  // 2026-08-15-encadrant-document-corrections-design.md.
  replyToDocumentId String?
  replyTo           Document?  @relation("DocumentReplies", fields: [replyToDocumentId], references: [id], onDelete: SetNull)
  replies           Document[] @relation("DocumentReplies")
  comments    Comment[]

  @@index([thesisId, uploadedAt])
  @@index([scheduledAt])
  @@index([replyToDocumentId])
}
```

(Don't worry about hand-aligning the new field's column spacing — Step 2 below fixes it automatically.)

- [ ] **Step 2: Auto-align the schema file**

Run: `pnpm --filter frontend exec prisma format` — this is Prisma's own formatter (column alignment for `.prisma` files); it is a separate tool from `pnpm format` (Prettier), which does not touch `.prisma` files at all.
Expected: reports `Formatted prisma\schema.prisma`. Confirm with `git diff frontend/prisma/schema.prisma` that only whitespace changed, not the field/relation names or types from Step 1.

- [ ] **Step 3: Apply the schema change**

Run: `pnpm db:push` (from repo root).
Expected: Prisma reports one new column + index added on `Document`, and regenerates the client. No data loss warning (the column is nullable).

- [ ] **Step 4: Confirm the generated client typechecks**

Run: `pnpm typecheck`
Expected: no new errors (nothing references `replyToDocumentId` yet).

- [ ] **Step 5: Format and commit**

Run: `pnpm format`

```bash
git add frontend/prisma/schema.prisma
git commit -m "feat(theses): add Document.replyToDocumentId self-relation"
```

---

### Task 2: Notification templates — `documentSubmitted` + `documentReceived`

**Files:**
- Modify: `frontend/src/lib/server/notifications/templates.ts`
- Create: `frontend/src/lib/server/notifications/templates.test.ts`

**Interfaces:**
- Consumes: `CreateNotificationInput` type from `./index` (already imported in `templates.ts`).
- Produces: `documentSubmitted(encadrantId: string, thesisId: string, documentId: string, chapter: string | null): CreateNotificationInput` and `documentReceived(studentId: string, thesisId: string, documentId: string, chapter: string | null): CreateNotificationInput`. Task 3's route handler calls both by these exact names and argument order.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/server/notifications/templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { documentSubmitted, documentReceived } from './templates';

describe('documentSubmitted', () => {
  it('builds a DOCUMENT_SUBMITTED notification for the encadrant with a chapter', () => {
    const input = documentSubmitted('enc-1', 'thesis-1', 'doc-1', 'Chapitre 3');
    expect(input.userId).toBe('enc-1');
    expect(input.type).toBe('DOCUMENT_SUBMITTED');
    expect(input.title).toBe('Nouveau document déposé');
    expect(input.body).toBe('Nouveau dépôt : Chapitre 3');
    expect(input.data).toEqual({ thesisId: 'thesis-1', documentId: 'doc-1' });
    expect(input.dedupeKey).toBe('document-submitted:doc-1');
  });

  it('falls back to a generic body when chapter is null', () => {
    const input = documentSubmitted('enc-1', 'thesis-1', 'doc-1', null);
    expect(input.body).toBe('Nouveau document déposé');
  });
});

describe('documentReceived', () => {
  it('builds a DOCUMENT_RECEIVED notification for the student with a chapter', () => {
    const input = documentReceived('stu-1', 'thesis-1', 'doc-2', 'Chapitre 3');
    expect(input.userId).toBe('stu-1');
    expect(input.type).toBe('DOCUMENT_RECEIVED');
    expect(input.title).toBe('Nouveau fichier de votre encadrant');
    expect(input.body).toBe('Correction reçue : Chapitre 3');
    expect(input.data).toEqual({ thesisId: 'thesis-1', documentId: 'doc-2' });
    expect(input.dedupeKey).toBe('document-received:doc-2');
  });

  it('falls back to a generic body when chapter is null', () => {
    const input = documentReceived('stu-1', 'thesis-1', 'doc-2', null);
    expect(input.body).toBe('Votre encadrant vous a envoyé un fichier');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run src/lib/server/notifications/templates.test.ts`
Expected: FAIL — `documentSubmitted`/`documentReceived` are not exported from `./templates`.

- [ ] **Step 3: Add the two functions**

In `frontend/src/lib/server/notifications/templates.ts`, add at the end of the file (after `planExpired`):

```ts
export function documentSubmitted(
  encadrantId: string,
  thesisId: string,
  documentId: string,
  chapter: string | null,
): CreateNotificationInput {
  return {
    userId: encadrantId,
    type: 'DOCUMENT_SUBMITTED',
    title: 'Nouveau document déposé',
    body: chapter ? `Nouveau dépôt : ${chapter}` : 'Nouveau document déposé',
    data: { thesisId, documentId },
    dedupeKey: `document-submitted:${documentId}`,
  };
}

export function documentReceived(
  studentId: string,
  thesisId: string,
  documentId: string,
  chapter: string | null,
): CreateNotificationInput {
  return {
    userId: studentId,
    type: 'DOCUMENT_RECEIVED',
    title: 'Nouveau fichier de votre encadrant',
    body: chapter ? `Correction reçue : ${chapter}` : 'Votre encadrant vous a envoyé un fichier',
    data: { thesisId, documentId },
    dedupeKey: `document-received:${documentId}`,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/lib/server/notifications/templates.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/server/notifications/templates.ts frontend/src/lib/server/notifications/templates.test.ts
git commit -m "feat(notifications): add documentSubmitted/documentReceived templates"
```

---

### Task 3: `POST /api/theses/[id]/documents` — encadrant reply branch

**Files:**
- Modify: `frontend/src/app/api/theses/[id]/documents/route.ts`
- Modify: `frontend/src/app/api/theses/[id]/documents/route.test.ts`
- Modify: `frontend/src/lib/theses.ts`

**Interfaces:**
- Consumes: `documentSubmitted`/`documentReceived` from Task 2 (`@/lib/server/notifications/templates`), `Document.replyToDocumentId` from Task 1.
- Produces: `ThesisDocument.replyToDocumentId: string | null` (propagates to `DocumentListItem` via `extends`) — Tasks 4-6 read this field on the client. New error code `INVALID_REPLY_TARGET` (400) — Task 4's modal maps it to a French message.

- [ ] **Step 1: Add `replyToDocumentId` to the shared client type**

In `frontend/src/lib/theses.ts`, find:

```ts
export interface ThesisDocument {
  id: string;
  chapter: string | null;
  fileUrl: string;
  fileName: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  /** "Programmer le dépôt" — set + in the future while pending release. */
  scheduledAt: string | null;
}
```

Replace with:

```ts
export interface ThesisDocument {
  id: string;
  chapter: string | null;
  fileUrl: string;
  fileName: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  /** "Programmer le dépôt" — set + in the future while pending release. */
  scheduledAt: string | null;
  /** Set only on an encadrant correction — the student deposit it replies to. */
  replyToDocumentId: string | null;
}
```

- [ ] **Step 2: Write the failing tests**

In `frontend/src/app/api/theses/[id]/documents/route.test.ts`, first **delete** this now-obsolete test (encadrants are no longer forbidden from posting):

```ts
  it('encadrant (not student) attempting upload → 403 STUDENT_ONLY', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await POST(makePost({ fileUrl: 'https://x.com/a.pdf' }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('STUDENT_ONLY');
  });
```

Then add these tests at the end of the `describe('POST /api/theses/[id]/documents', ...)` block, right before its closing `});`:

```ts
  it('student sending replyToDocumentId → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', encadrantId: 'enc-1' }) as never,
    );
    const res = await POST(
      makePost({ fileUrl: 'https://x.com/a.pdf', replyToDocumentId: 'doc-orig' }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it('encadrant reply with missing replyToDocumentId → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    const res = await POST(makePost({ fileUrl: 'https://x.com/correction.pdf' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it('encadrant reply with scheduledAt → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    const futureIso = new Date(Date.now() + 60 * 60_000).toISOString();
    const res = await POST(
      makePost({
        fileUrl: 'https://x.com/correction.pdf',
        replyToDocumentId: 'doc-orig',
        scheduledAt: futureIso,
      }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it('encadrant reply target not found in this thesis → 400 INVALID_REPLY_TARGET', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.document.findFirst.mockResolvedValue(null);
    const res = await POST(
      makePost({ fileUrl: 'https://x.com/correction.pdf', replyToDocumentId: 'doc-missing' }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_REPLY_TARGET');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
    const findArgs = prismaMock.document.findFirst.mock.calls[0]?.[0];
    expect(findArgs?.where).toEqual({
      id: 'doc-missing',
      thesisId: 'thesis-1',
      replyToDocumentId: null,
    });
  });

  it('encadrant reply target is itself a reply → 400 INVALID_REPLY_TARGET', async () => {
    // The findFirst query filters `replyToDocumentId: null` on the target, so
    // a reply-to-a-reply naturally resolves to null here — same code path as
    // "not found", asserted separately to document the business rule.
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.document.findFirst.mockResolvedValue(null);
    const res = await POST(
      makePost({ fileUrl: 'https://x.com/correction.pdf', replyToDocumentId: 'doc-already-a-reply' }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_REPLY_TARGET');
  });

  it('encadrant reply happy path → 201, persists replyToDocumentId, notifies the student', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc-orig',
      replyToDocumentId: null,
    } as never);
    prismaMock.document.create.mockResolvedValue({
      id: 'doc-correction',
      thesisId: 'thesis-1',
      replyToDocumentId: 'doc-orig',
    } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(
      makePost({
        fileUrl: 'https://x.com/correction.pdf',
        chapter: 'Chapitre 3',
        replyToDocumentId: 'doc-orig',
      }),
      { params },
    );
    expect(res.status).toBe(201);
    const createArg = prismaMock.document.create.mock.calls[0]?.[0];
    expect(createArg?.data?.replyToDocumentId).toBe('doc-orig');
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.userId).toBe('stu-1');
    expect(notifArg?.data?.type).toBe('DOCUMENT_RECEIVED');
    expect(notifArg?.data?.dedupeKey).toBe('document-received:doc-correction');
  });

  it('encadrant reply while thesis is Bloqué → still succeeds (guard is student-only)', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1', stage: 'Bloqué' }) as never,
    );
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc-orig',
      replyToDocumentId: null,
    } as never);
    prismaMock.document.create.mockResolvedValue({ id: 'doc-correction' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(
      makePost({ fileUrl: 'https://x.com/correction.pdf', replyToDocumentId: 'doc-orig' }),
      { params },
    );
    expect(res.status).toBe(201);
  });
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `pnpm --filter frontend exec vitest run src/app/api/theses/[id]/documents/route.test.ts`
Expected: FAIL — current route still 403s any non-student caller and doesn't know `replyToDocumentId`.

- [ ] **Step 4: Replace the route implementation**

Replace the full contents of `frontend/src/app/api/theses/[id]/documents/route.ts` with:

```ts
// ThèseFacile — GET + POST /api/theses/[id]/documents.
//
// "Bibliothèque de documents" (encadrant) + "Dépôt de fichier étudiant".
// Storage itself is NOT reinvented here — the client uploads to Cloudinary
// via the existing /api/upload route first, then POSTs the resulting URL
// here to attach it to the thesis. The student deposits documents; the
// encadrant can reply to one specific deposit with a correction file
// (`replyToDocumentId`) — both land in the same list, distinguished only
// by that field. See docs/superpowers/specs/
// 2026-08-15-encadrant-document-corrections-design.md.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { createNotification } from '@/lib/server/notifications';
import { documentSubmitted, documentReceived } from '@/lib/server/notifications/templates';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const CreateBody = z.object({
  fileUrl: z.string().url(),
  chapter: z.string().trim().max(200).optional(),
  // Optional: Cloudinary's upload response carries `original_filename`/
  // `bytes` — pass them through here once a real upload UI exists (Phase 6).
  fileName: z.string().trim().max(255).optional(),
  sizeBytes: z.number().int().positive().optional(),
  // "Programmer le dépôt" — file uploads to storage now regardless, but a
  // future scheduledAt defers visibility to the encadrant + the
  // DOCUMENT_SUBMITTED notification until the scheduled-deposits cron
  // releases it (see that route). Student uploads only.
  scheduledAt: z.string().datetime().optional(),
  // Set only by the encadrant — the student deposit this correction replies
  // to. Required for an encadrant upload, forbidden for a student upload.
  replyToDocumentId: z.string().min(1).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const access = await resolveThesisAccess(prisma, id, auth.user.sub);
    if (access instanceof NextResponse) return access;

    // The encadrant doesn't see a scheduled deposit until it's released —
    // the student (uploader) can always see their own, pending or not.
    const isEncadrant = access.encadrantId === auth.user.sub;
    const documents = await prisma.document.findMany({
      where: {
        thesisId: id,
        ...(isEncadrant
          ? { OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] }
          : {}),
      },
      orderBy: [{ uploadedAt: 'desc' }],
    });

    return NextResponse.json({ items: documents }, { headers: { 'x-request-id': ctx.requestId } });
  });
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const access = await resolveThesisAccess(prisma, id, auth.user.sub);
    if (access instanceof NextResponse) return access;

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid request body',
          issues: parsed.error.issues,
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const isStudent = access.studentId === auth.user.sub;
    let scheduledAt: Date | null = null;

    if (isStudent) {
      if (parsed.data.replyToDocumentId) {
        return NextResponse.json(
          { error: 'VALIDATION_FAILED', message: 'Only the encadrant can reply to a document' },
          { status: 400, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      if (access.stage === 'Bloqué') {
        return NextResponse.json(
          { error: 'THESIS_BLOCKED', message: 'The encadrant has blocked this thesis' },
          { status: 403, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
      if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'SCHEDULED_AT_IN_PAST', message: 'scheduledAt must be in the future' },
          { status: 400, headers: { 'x-request-id': ctx.requestId } },
        );
      }
    } else {
      // resolveThesisAccess already guarantees student-or-encadrant, so this
      // branch is the encadrant.
      if (!parsed.data.replyToDocumentId) {
        return NextResponse.json(
          {
            error: 'VALIDATION_FAILED',
            message: 'replyToDocumentId is required for encadrant uploads',
          },
          { status: 400, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      if (parsed.data.scheduledAt) {
        return NextResponse.json(
          {
            error: 'VALIDATION_FAILED',
            message: 'scheduledAt is not supported for encadrant uploads',
          },
          { status: 400, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      // Target must exist, belong to this thesis, and not itself already be
      // a reply — keeps corrections one level deep.
      const target = await prisma.document.findFirst({
        where: { id: parsed.data.replyToDocumentId, thesisId: id, replyToDocumentId: null },
      });
      if (!target) {
        return NextResponse.json(
          { error: 'INVALID_REPLY_TARGET', message: 'This document cannot be replied to' },
          { status: 400, headers: { 'x-request-id': ctx.requestId } },
        );
      }
    }

    const document = await prisma.document.create({
      data: {
        thesisId: id,
        fileUrl: parsed.data.fileUrl,
        ...(parsed.data.chapter !== undefined ? { chapter: parsed.data.chapter } : {}),
        ...(parsed.data.fileName !== undefined ? { fileName: parsed.data.fileName } : {}),
        ...(parsed.data.sizeBytes !== undefined ? { sizeBytes: parsed.data.sizeBytes } : {}),
        ...(scheduledAt ? { scheduledAt } : {}),
        ...(parsed.data.replyToDocumentId
          ? { replyToDocumentId: parsed.data.replyToDocumentId }
          : {}),
      },
    });

    // A scheduled deposit stays invisible to the encadrant until the
    // scheduled-deposits cron releases it — that's when this same
    // notification fires instead.
    if (isStudent && !scheduledAt) {
      try {
        await createNotification(
          prisma,
          documentSubmitted(access.encadrantId, id, document.id, parsed.data.chapter ?? null),
        );
      } catch {
        // Notification is best-effort — the document is already committed.
      }
    } else if (!isStudent) {
      try {
        await createNotification(
          prisma,
          documentReceived(access.studentId, id, document.id, parsed.data.chapter ?? null),
        );
      } catch {
        // Notification is best-effort — the document is already committed.
      }
    }

    return NextResponse.json(document, { status: 201, headers: { 'x-request-id': ctx.requestId } });
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/theses/[id]/documents/route.test.ts`
Expected: PASS — all existing tests (GET tests, student happy path, `THESIS_BLOCKED`, `SCHEDULED_AT_IN_PAST`, etc.) plus every new test from Step 2.

- [ ] **Step 6: Full test suite + typecheck**

Run: `pnpm typecheck && pnpm test`
Expected: no regressions elsewhere (nothing else references the deleted `STUDENT_ONLY`-for-encadrant behavior).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/api/theses/\[id\]/documents/route.ts frontend/src/app/api/theses/\[id\]/documents/route.test.ts frontend/src/lib/theses.ts
git commit -m "feat(theses): let the encadrant reply to a document with a correction"
```

---

### Task 4: `SendCorrectionModal` component

**Files:**
- Create: `frontend/src/components/dashboard/SendCorrectionModal.tsx`

**Interfaces:**
- Consumes: `uploadFile` (`@/lib/uploadFile`), `api`/`ApiError` (`@/lib/api`), `POST /api/theses/[id]/documents` with `replyToDocumentId` (Task 3), `POST /api/theses/[id]/comments` (existing, unchanged).
- Produces: `SendCorrectionModal({ thesisId, replyToDocumentId, chapterHint, onClose, onSent }: SendCorrectionModalProps)`. Task 5 renders this component and supplies all five props.

No test file for this task — no `.tsx` test infra in this repo (Global Constraints). Verified by manual QA in Task 5, once it's wired up and reachable from the UI.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/SendCorrectionModal.tsx`:

```tsx
// "Envoyer une correction" modal — the encadrant replies to a specific
// student deposit with a file. Same upload plumbing as
// StudentFileUploadForm (/api/upload → /api/theses/[id]/documents),
// condensed into a modal (like UpgradeModal) since the action always
// starts from one specific DocumentRow rather than a dedicated page.
'use client';

import { useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { Icon } from '@/components/ui/Icon';
import { formatFileSize, type ThesisDocument } from '@/lib/theses';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.odt'];
const ACCEPTED_ATTR =
  '.pdf,.docx,.odt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text';
// Client-side pre-check only, for UX — the server remains the real trust
// boundary via UPLOAD_ALLOWED_MIME + magic-byte sniffing.
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const ERROR_MESSAGES: Record<string, string> = {
  STORAGE_NOT_CONFIGURED:
    "Le stockage de fichiers n'est pas encore configuré par votre établissement.",
  UPLOAD_MISSING_FILE: 'Aucun fichier reçu — réessayez.',
  FILE_TOO_LARGE: 'Le fichier dépasse la taille maximale autorisée (10 Mo).',
  INVALID_MIME: "Ce type de fichier n'est pas accepté (formats acceptés : PDF, DOCX, ODT).",
  MAGIC_BYTE_MISMATCH: 'Le contenu du fichier ne correspond pas au format déclaré.',
  UPLOAD_FAILED: 'Le téléversement a échoué — réessayez.',
  VALIDATION_FAILED: 'Vérifiez les champs du formulaire.',
  INVALID_REPLY_TARGET: 'Ce document ne peut plus recevoir de correction.',
};

interface SendCorrectionModalProps {
  thesisId: string;
  replyToDocumentId: string;
  chapterHint?: string | null;
  onClose: () => void;
  onSent: () => void;
}

export function SendCorrectionModal({
  thesisId,
  replyToDocumentId,
  chapterHint,
  onClose,
  onSent,
}: SendCorrectionModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [chapter, setChapter] = useState(chapterHint ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateAndSetFile(f: File) {
    if (f.size > MAX_SIZE_BYTES) {
      setError('Le fichier dépasse la taille maximale autorisée (10 Mo).');
      return;
    }
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError("Ce type de fichier n'est pas accepté (formats acceptés : PDF, DOCX, ODT).");
      return;
    }
    setError(null);
    setFile(f);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSetFile(f);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Sélectionnez un fichier à envoyer.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const uploaded = await uploadFile(file);
      const document = await api<ThesisDocument>(`/api/theses/${thesisId}/documents`, {
        method: 'POST',
        body: {
          fileUrl: uploaded.url,
          fileName: uploaded.filename,
          sizeBytes: uploaded.sizeBytes,
          replyToDocumentId,
          ...(chapter.trim() ? { chapter: chapter.trim() } : {}),
        },
      });

      if (note.trim()) {
        // Best-effort — the document send already succeeded and is what
        // matters, same pattern as StudentFileUploadForm's notes.
        await api(`/api/theses/${thesisId}/comments`, {
          method: 'POST',
          body: { body: note.trim(), documentId: document.id },
        }).catch(() => {});
      }

      onSent();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError('Une erreur est survenue.');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headings text-base font-semibold text-foreground">
            Envoyer une correction
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted-foreground"
          >
            <Icon i="x" size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
              dragActive ? 'border-primary bg-secondary' : 'border-border'
            }`}
          >
            {file ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-left">
                <div className="w-9 h-9 rounded-sm bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                  <Icon i="file-text" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {file.name.slice(file.name.lastIndexOf('.') + 1).toUpperCase()} ·{' '}
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Retirer le fichier"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Icon i="x" size={14} />
                </button>
              </div>
            ) : (
              <>
                <Icon i="file-up" size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-foreground mb-1">Glissez-déposez votre fichier ici</p>
                <p className="text-xs text-muted-foreground mb-2">ou</p>
              </>
            )}
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary border border-primary rounded-sm px-3 py-1.5 cursor-pointer">
              <Icon i="upload" size={12} />
              {file ? 'Changer de fichier' : 'Parcourir'}
              <input type="file" accept={ACCEPTED_ATTR} className="hidden" onChange={onFileChange} />
            </label>
            <p className="text-xs text-muted-foreground mt-2">
              Max 10 Mo — Formats : .docx, .pdf, .odt
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Chapitre
            </span>
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Ex. Chapitre 3"
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Note (optionnel)
            </span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ajoutez un commentaire pour l'étudiant…"
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none resize-none focus:border-primary"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-sm bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Icon i="send" size={14} />
            {submitting ? 'Envoi en cours…' : 'Envoyer'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (`ThesisDocument` is only used as the generic type parameter for `api<ThesisDocument>` — the returned `document.id` is what Step-1's comment-linking code needs.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/SendCorrectionModal.tsx
git commit -m "feat(dashboard): add SendCorrectionModal for encadrant file replies"
```

---

### Task 5: Wire the modal into `DocumentRow` and the Bibliothèque page

**Files:**
- Modify: `frontend/src/components/dashboard/DocumentRow.tsx`
- Modify: `frontend/src/app/documents/page.tsx`

**Interfaces:**
- Consumes: `SendCorrectionModal` (Task 4), `DocumentListItem.replyToDocumentId` (Task 3), `documentDisplayName` (`@/lib/theses`, already exists).
- Produces: `DocumentRow({ doc, onSendCorrection, replyToLabel })` — `onSendCorrection: (doc: DocumentListItem) => void` is now **required** (was previously just `{ doc }`).

No test file — no `.tsx` test infra (Global Constraints). Manual QA at the end of this task.

- [ ] **Step 1: Update `DocumentRow`**

Replace the full contents of `frontend/src/components/dashboard/DocumentRow.tsx` with:

```tsx
// Banani `DocumentsLibraryScreen` inlined this row markup rather than
// shipping it as a shared component — extracted here since the project
// already has a "one row = one component" convention (StudentRow). A row
// where `replyToDocumentId` is set is an encadrant correction, not a
// student deposit — it shows a badge instead of the "send correction"
// action (you can't reply to a reply).
import {
  STAGE_COLORS,
  displayName,
  documentDisplayName,
  documentFormat,
  formatDate,
  formatFileSize,
  type DocumentListItem,
} from '@/lib/theses';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';

interface DocumentRowProps {
  doc: DocumentListItem;
  onSendCorrection: (doc: DocumentListItem) => void;
  /** Display name of the document this one replies to, when known. */
  replyToLabel?: string | null;
}

export function DocumentRow({ doc, onSendCorrection, replyToLabel }: DocumentRowProps) {
  const stageClass = STAGE_COLORS[doc.thesis.stage] || 'bg-muted text-muted-foreground';
  const isCorrection = doc.replyToDocumentId != null;

  return (
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border last:border-0 transition-colors duration-150 hover:bg-surface lg:flex-row lg:items-center lg:gap-4">
      <div className="flex items-center gap-2 text-sm text-foreground lg:w-40 lg:shrink-0">
        <Icon i="file-text" size={16} className="text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <span className="truncate font-medium block">{documentDisplayName(doc)}</span>
          {isCorrection && (
            <span className="truncate block text-xs text-muted-foreground">
              {replyToLabel ? `↳ réponse à ${replyToLabel}` : "Correction de l'encadrant"}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground lg:contents lg:text-sm">
        <div className="lg:w-48 lg:shrink-0 lg:text-foreground">
          {displayName(doc.thesis.student)}
        </div>
        <div
          className={`lg:w-28 lg:shrink-0 font-medium px-2 py-1 rounded-sm text-center ${stageClass}`}
        >
          {doc.thesis.stage}
        </div>
        <div className="lg:w-32 lg:shrink-0">{formatDate(doc.uploadedAt)}</div>
        <div className="lg:w-20 lg:shrink-0">{formatFileSize(doc.sizeBytes)}</div>
        <div className="lg:flex-1 uppercase font-medium">{documentFormat(doc)}</div>
      </div>
      <div className="flex items-center justify-end gap-2 lg:shrink-0 lg:w-28">
        {isCorrection ? (
          <span className="text-xs font-medium px-2 py-1 rounded-sm bg-accent/10 text-accent">
            Correction
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onSendCorrection(doc)}
            aria-label="Envoyer une correction"
            className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <Icon i="send" size={14} />
          </button>
        )}
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
          aria-label="Télécharger"
        >
          <Icon i="download" size={14} />
        </a>
      </div>
    </div>
  );
}

export function DocumentRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border last:border-0 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex items-center gap-2 lg:w-40 lg:shrink-0">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:contents">
        <Skeleton className="h-3.5 w-28 lg:w-48" />
        <Skeleton className="h-5 w-16 lg:w-28" />
        <Skeleton className="h-3.5 w-20 lg:w-32" />
        <Skeleton className="h-3.5 w-10 lg:w-20" />
        <Skeleton className="h-3.5 w-10 lg:flex-1" />
      </div>
      <div className="flex items-center justify-end lg:shrink-0 lg:w-28">
        <Skeleton className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the Bibliothèque page**

In `frontend/src/app/documents/page.tsx`:

Find the import block:

```ts
import { DocumentRow, DocumentRowSkeleton } from '@/components/dashboard/DocumentRow';
import { StudentDocumentsContent } from '@/components/student/StudentDocumentsContent';
import {
  displayName,
  documentFormat,
  type DocumentListItem,
  type ThesisListItem,
} from '@/lib/theses';
```

Replace with:

```ts
import { DocumentRow, DocumentRowSkeleton } from '@/components/dashboard/DocumentRow';
import { SendCorrectionModal } from '@/components/dashboard/SendCorrectionModal';
import { StudentDocumentsContent } from '@/components/student/StudentDocumentsContent';
import {
  displayName,
  documentDisplayName,
  documentFormat,
  type DocumentListItem,
  type ThesisListItem,
} from '@/lib/theses';
```

Find:

```ts
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [extraItems, setExtraItems] = useState<DocumentListItem[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
```

Replace with:

```ts
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [extraItems, setExtraItems] = useState<DocumentListItem[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sendCorrectionDoc, setSendCorrectionDoc] = useState<DocumentListItem | null>(null);
```

Find:

```ts
  const { data: docsRes, loading: docsLoading } = useApi<DocumentsResponse>(apiPath, {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });
```

Replace with:

```ts
  const {
    data: docsRes,
    loading: docsLoading,
    refresh: refreshDocs,
  } = useApi<DocumentsResponse>(apiPath, {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });
```

Find:

```ts
  const items = useMemo(() => [...(docsRes?.items ?? []), ...extraItems], [docsRes, extraItems]);
  const cursor = extraCursor !== null ? extraCursor : (docsRes?.nextCursor ?? null);
```

Replace with:

```ts
  const items = useMemo(() => [...(docsRes?.items ?? []), ...extraItems], [docsRes, extraItems]);
  const cursor = extraCursor !== null ? extraCursor : (docsRes?.nextCursor ?? null);
  const byId = useMemo(() => {
    const map = new Map<string, DocumentListItem>();
    for (const d of items) map.set(d.id, d);
    return map;
  }, [items]);

  function replyToLabelFor(doc: DocumentListItem): string | null {
    if (!doc.replyToDocumentId) return null;
    const target = byId.get(doc.replyToDocumentId);
    return target ? documentDisplayName(target) : null;
  }
```

Find:

```tsx
            {filtered.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
```

Replace with:

```tsx
            {filtered.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onSendCorrection={setSendCorrectionDoc}
                replyToLabel={replyToLabelFor(doc)}
              />
            ))}
```

Find the table-header action column (empty spacer matching the row's action width):

```tsx
              <div className="shrink-0 w-16" />
```

Replace with (widened to fit the new badge/button pair — must match `DocumentRow`'s `lg:w-28` action column):

```tsx
              <div className="shrink-0 w-28" />
```

Find the closing of the content `<div>` (right before the final `</DashboardShell>`):

```tsx
        <div className="mt-8 p-4 bg-surface border border-border rounded-md flex items-start gap-3">
          <Icon i="info" size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Tous les documents soumis par vos étudiants sont archivés ici. Cliquez sur l&apos;icône
            de téléchargement pour ouvrir un fichier.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
```

Replace with:

```tsx
        <div className="mt-8 p-4 bg-surface border border-border rounded-md flex items-start gap-3">
          <Icon i="info" size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Tous les documents soumis par vos étudiants sont archivés ici. Cliquez sur l&apos;icône
            de téléchargement pour ouvrir un fichier.
          </p>
        </div>
      </div>
      {sendCorrectionDoc && (
        <SendCorrectionModal
          thesisId={sendCorrectionDoc.thesis.id}
          replyToDocumentId={sendCorrectionDoc.id}
          chapterHint={sendCorrectionDoc.chapter}
          onClose={() => setSendCorrectionDoc(null)}
          onSent={() => {
            setSendCorrectionDoc(null);
            void refreshDocs();
            toast('Correction envoyée avec succès', 'success');
          }}
        />
      )}
    </DashboardShell>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. (`toast` is already destructured from `useToast()` earlier in this component — confirm the existing `const { toast } = useToast();` line is still present; it is not touched by this task.)

- [ ] **Step 4: Manual QA**

Run: `pnpm dev` (from repo root), open `http://localhost:3000/documents` logged in as an encadrant with at least one student deposit.

1. Confirm each non-reply document row shows a "send" icon button next to the download icon.
2. Click it → `SendCorrectionModal` opens.
3. Drag a `.pdf`/`.docx`/`.odt` file in (or use "Parcourir"), optionally fill "Chapitre" (pre-filled from the original's chapter) and "Note", click "Envoyer".
4. Expected: modal closes, a "Correction envoyée avec succès" toast appears, the list refreshes and shows the new row with a "Correction" badge and a "↳ réponse à …" caption under the filename.
5. Confirm the new correction row has **no** send button (can't reply to a reply).
6. Repeat once more against the same original deposit — confirm a second correction is accepted (no "already replied" restriction).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/DocumentRow.tsx frontend/src/app/documents/page.tsx
git commit -m "feat(dashboard): wire SendCorrectionModal into the Bibliothèque de documents"
```

---

### Task 6: `StudentDocumentRow` — correction badge

**Files:**
- Modify: `frontend/src/components/student/StudentDocumentRow.tsx`

**Interfaces:**
- Consumes: `ThesisDocument.replyToDocumentId` (Task 3).

No test file — no `.tsx` test infra (Global Constraints). Manual QA at the end of this task.

- [ ] **Step 1: Update the component**

Replace the full contents of `frontend/src/components/student/StudentDocumentRow.tsx` with:

```tsx
// Simpler than the encadrant `DocumentRow` (components/dashboard/) — no
// student-name/stage columns needed, since this is already "my" documents.
// `commented` is a real derivation (≥1 Comment linked to this document),
// replacing Banani's 3-state status pill (En cours de révision/Commenté/
// Validé) — no schema field backs a "validated" verdict, only whether
// feedback exists (see phase-7-dashboard-etudiant.md). A row where
// `replyToDocumentId` is set is a correction the encadrant sent, not a
// deposit awaiting review — the commented/pending pill doesn't apply, so it
// shows a distinct "De votre encadrant" badge instead.
import { documentDisplayName, formatDate, formatFileSize, type ThesisDocument } from '@/lib/theses';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';

interface StudentDocumentRowProps {
  doc: ThesisDocument;
  commented: boolean;
}

export function StudentDocumentRow({ doc, commented }: StudentDocumentRowProps) {
  const isPendingSchedule = !!doc.scheduledAt && new Date(doc.scheduledAt).getTime() > Date.now();
  const isCorrection = doc.replyToDocumentId != null;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 transition-colors duration-150 hover:bg-input/40">
      <div className="w-8 h-8 rounded-sm bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
        <Icon i="file-text" size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {documentDisplayName(doc)}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatDate(doc.uploadedAt)} · {formatFileSize(doc.sizeBytes)}
        </div>
      </div>
      {isPendingSchedule ? (
        <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-sm shrink-0 bg-accent/10 text-accent">
          <Icon i="clock" size={11} />
          Programmé · {formatDate(doc.scheduledAt as string)}
        </div>
      ) : isCorrection ? (
        <div className="text-xs font-medium px-2 py-1 rounded-sm shrink-0 bg-accent/10 text-accent">
          De votre encadrant
        </div>
      ) : (
        <div
          className={`text-xs font-medium px-2 py-1 rounded-sm shrink-0 ${
            commented
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-warning text-warning-foreground'
          }`}
        >
          {commented ? 'Commenté' : 'En attente de retour'}
        </div>
      )}
      <a
        href={doc.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground"
        aria-label="Télécharger"
      >
        <Icon i="download" size={14} />
      </a>
    </div>
  );
}

export function StudentDocumentRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0">
      <Skeleton className="h-8 w-8 shrink-0 rounded-sm" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-20 shrink-0" />
      <Skeleton className="h-3.5 w-3.5" />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Manual QA**

With `pnpm dev` still running (Task 5), log in as the student on the thesis you sent a correction to in Task 5's QA.

1. Visit `/documents` (student "Mes documents") and the dashboard's embedded documents card.
2. Confirm the correction row shows a "De votre encadrant" badge instead of "Commenté"/"En attente de retour".
3. Confirm your own deposits still show the normal commented/pending pill, unaffected.

- [ ] **Step 4: Full suite, then commit**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: everything green.

```bash
git add frontend/src/components/student/StudentDocumentRow.tsx
git commit -m "feat(student): show a distinct badge for encadrant-sent corrections"
```

---

## Post-implementation

Once all 6 tasks are complete and the final whole-branch review (part of subagent-driven-development) is clean, this plan's SDD workspace (`.superpowers/sdd/2026-08-15-encadrant-document-corrections/`) should be deleted per that skill's cleanup step, and `superpowers:finishing-a-development-branch` should be used to decide how this work gets merged/pushed.
