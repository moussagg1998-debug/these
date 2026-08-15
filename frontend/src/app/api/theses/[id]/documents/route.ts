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
