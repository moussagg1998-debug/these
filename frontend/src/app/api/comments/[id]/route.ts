// ThèseFacile — PATCH /api/comments/[id].
//
// Toggles `resolved` from the "Commentaires — Vue d'ensemble" screen.
// Encadrant-only — "resolved" is the encadrant's own triage call on their
// feedback thread. Top-level route (not nested under /api/theses/[id])
// because the Comments Overview page works across theses and shouldn't
// need to know which thesis a comment belongs to just to resolve it.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PatchBody = z.object({
  resolved: z.boolean(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json(
        { error: 'COMMENT_NOT_FOUND', message: 'Comment not found' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const access = await resolveThesisAccess(prisma, comment.thesisId, auth.user.sub);
    if (access instanceof NextResponse) return access;
    if (access.encadrantId !== auth.user.sub) {
      return NextResponse.json(
        { error: 'ENCADRANT_ONLY', message: 'Only the encadrant can resolve a comment' },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
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

    const updated = await prisma.comment.update({
      where: { id },
      data: { resolved: parsed.data.resolved },
    });

    return NextResponse.json(updated, { headers: { 'x-request-id': ctx.requestId } });
  });
}
