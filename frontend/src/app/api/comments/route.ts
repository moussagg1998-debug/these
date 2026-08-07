// ThèseFacile — GET /api/comments.
//
// "Commentaires — Vue d'ensemble" (Banani) — a cross-thesis aggregate of
// top-level feedback threads (parentId: null), unlike GET
// /api/theses/[id]/comments which is scoped to one thesis and includes
// replies inline. Encadrant-only. Comment has a real `createdAt` field so
// this reuses the shared cursorWhere/buildPage helpers directly.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';

import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { requireProfileType } from '@/lib/server/theses/guards';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const profile = await requireProfileType(prisma, auth.user.sub, ['ENCADRANT']);
    if (profile instanceof NextResponse) return profile;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const cursor = decodeCursor(url.searchParams.get('cursor'));
    const studentId = url.searchParams.get('studentId');
    const resolvedParam = url.searchParams.get('resolved');
    const priority = url.searchParams.get('priority');

    const baseWhere: Prisma.CommentWhereInput = {
      parentId: null,
      thesis: {
        encadrantId: auth.user.sub,
        archivedAt: null,
        ...(studentId ? { studentId } : {}),
      },
      ...(resolvedParam !== null ? { resolved: resolvedParam === 'true' } : {}),
      ...(priority ? { priority } : {}),
    };
    const where: Prisma.CommentWhereInput = { ...baseWhere, ...cursorWhere(cursor) };

    // Sequential, not Promise.all: DATABASE_URL pins connection_limit=1 for
    // serverless (see .env.local) — two concurrent queries on one request
    // would fight over the single pooled connection and can exceed
    // pool_timeout under load.
    const rows = await prisma.comment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        document: { select: { id: true, chapter: true, fileName: true, fileUrl: true } },
        thesis: {
          select: {
            id: true,
            topic: true,
            student: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        _count: { select: { replies: true } },
      },
    });
    const total = await prisma.comment.count({ where: baseWhere });

    return NextResponse.json(
      { ...buildPage(rows, limit), total },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
