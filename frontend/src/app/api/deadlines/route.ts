// ThèseFacile — GET /api/deadlines.
//
// "Échéances — Calendrier" (Banani) — a cross-thesis aggregate, unlike
// GET /api/theses/[id]/deadlines which is scoped to one thesis. Encadrant-
// only: this is the supervisor's calendar across every student they
// encadre. Unlike /api/documents and /api/comments, this is deliberately
// NOT cursor-paginated — a calendar wants "everything grouped by urgency
// bucket," not an infinite-scroll feed. Capped at `take: 200` as a sanity
// ceiling (see .planning/banani/phase-5-deadlines.md).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';

import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { requireProfileType } from '@/lib/server/theses/guards';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const profile = await requireProfileType(prisma, auth.user.sub, ['ENCADRANT']);
    if (profile instanceof NextResponse) return profile;

    const studentId = req.nextUrl.searchParams.get('studentId');

    const where: Prisma.DeadlineWhereInput = {
      thesis: {
        encadrantId: auth.user.sub,
        ...(studentId ? { studentId } : {}),
      },
    };

    const items = await prisma.deadline.findMany({
      where,
      orderBy: [{ dueAt: 'asc' }],
      take: 200,
      include: {
        thesis: {
          select: {
            id: true,
            topic: true,
            stage: true,
            student: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    return NextResponse.json({ items }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
