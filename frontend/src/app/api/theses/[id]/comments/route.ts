// ThèseFacile — GET + POST /api/theses/[id]/comments.
//
// "Commentaires — Vue d'ensemble" + the CommentThread component (threaded
// replies via `parentId`). Both sides of the thesis can read and post —
// the Banani flow shows the encadrant commenting on chapters and the
// student replying in the same thread.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { createNotification } from '@/lib/server/notifications';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const CreateBody = z.object({
  body: z.string().trim().min(1).max(5000),
  documentId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
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

    const comments = await prisma.comment.findMany({
      where: { thesisId: id },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        document: { select: { id: true, chapter: true } },
      },
    });

    return NextResponse.json({ items: comments }, { headers: { 'x-request-id': ctx.requestId } });
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
    if (access.stage === 'Bloqué' && access.studentId === auth.user.sub) {
      return NextResponse.json(
        { error: 'THESIS_BLOCKED', message: 'The encadrant has blocked this thesis' },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }

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

    if (parsed.data.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentId } });
      if (!parent || parent.thesisId !== id) {
        return NextResponse.json(
          { error: 'PARENT_NOT_FOUND', message: 'Parent comment not found on this thesis' },
          { status: 404, headers: { 'x-request-id': ctx.requestId } },
        );
      }
    }

    const comment = await prisma.comment.create({
      data: {
        thesisId: id,
        authorId: auth.user.sub,
        body: parsed.data.body,
        ...(parsed.data.documentId !== undefined ? { documentId: parsed.data.documentId } : {}),
        ...(parsed.data.parentId !== undefined ? { parentId: parsed.data.parentId } : {}),
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      },
    });

    const recipientId = access.studentId === auth.user.sub ? access.encadrantId : access.studentId;
    try {
      await createNotification(prisma, {
        userId: recipientId,
        type: 'COMMENT_ADDED',
        title: 'Nouveau commentaire',
        body: parsed.data.body.slice(0, 140),
        data: { thesisId: id, commentId: comment.id },
        dedupeKey: `comment-added:${comment.id}`,
      });
    } catch {
      // Notification is best-effort — the comment is already committed.
    }

    return NextResponse.json(comment, { status: 201, headers: { 'x-request-id': ctx.requestId } });
  });
}
