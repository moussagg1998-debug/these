// ThèseFacile — GET + PATCH /api/theses/[id].
//
// GET: detail view ("Détail Étudiant — Profil") — either side of the thesis
// (student or encadrant) may read it.
// PATCH: update stage/progress — encadrant-only (the student doesn't
// self-report progress in the Banani flow; the encadrant tracks it).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const STAGES = ['En attente', 'Rédaction', 'Révision', 'Bloqué', 'Soutenance'] as const;

const PatchBody = z.object({
  stage: z.enum(STAGES).optional(),
  progress: z.number().int().min(0).max(100).optional(),
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

    const thesis = await prisma.thesis.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, email: true, avatarUrl: true } },
        encadrant: { select: { id: true, name: true, email: true, avatarUrl: true } },
        // Same enrichment as GET /api/theses — see that route's comments for
        // why "pendingComments" is a total count, not a resolved/unresolved one.
        deadlines: { where: { dueAt: { gte: new Date() } }, orderBy: { dueAt: 'asc' }, take: 1 },
        _count: { select: { comments: true } },
      },
    });

    return NextResponse.json(thesis, { headers: { 'x-request-id': ctx.requestId } });
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const access = await resolveThesisAccess(prisma, id, auth.user.sub);
    if (access instanceof NextResponse) return access;
    if (access.encadrantId !== auth.user.sub) {
      return NextResponse.json(
        { error: 'ENCADRANT_ONLY', message: 'Only the encadrant can update stage/progress' },
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

    const thesis = await prisma.thesis.update({
      where: { id },
      data: {
        ...(parsed.data.stage !== undefined ? { stage: parsed.data.stage } : {}),
        ...(parsed.data.progress !== undefined ? { progress: parsed.data.progress } : {}),
      },
    });

    return NextResponse.json(thesis, { headers: { 'x-request-id': ctx.requestId } });
  });
}
