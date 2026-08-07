// ThèseFacile — GET /api/documents.
//
// "Bibliothèque de documents" (Banani) — a cross-thesis aggregate, unlike
// GET /api/theses/[id]/documents which is scoped to one thesis. Encadrant-
// only: this is the supervisor's overview across every student they
// encadre. Document has no `createdAt` field (only `uploadedAt`), so this
// route can't reuse the createdAt-keyed cursorWhere/buildPage helpers from
// pagination/paginate.ts as-is — it re-derives the same cursor shape
// (encodeCursor/decodeCursor are field-name agnostic) against `uploadedAt`
// instead.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';

import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { requireProfileType } from '@/lib/server/theses/guards';
import { clampLimit, encodeCursor, decodeCursor } from '@/lib/server/pagination/paginate';
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

    const baseWhere: Prisma.DocumentWhereInput = {
      thesis: {
        encadrantId: auth.user.sub,
        archivedAt: null,
        ...(studentId ? { studentId } : {}),
      },
    };
    const where: Prisma.DocumentWhereInput = {
      ...baseWhere,
      ...(cursor
        ? {
            OR: [
              { uploadedAt: { lt: cursor.createdAt } },
              { uploadedAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    };

    // Sequential, not Promise.all: DATABASE_URL pins connection_limit=1 for
    // serverless (see .env.local) — two concurrent queries on one request
    // would fight over the single pooled connection and can exceed
    // pool_timeout under load.
    const rows = await prisma.document.findMany({
      where,
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
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
    const total = await prisma.document.count({ where: baseWhere });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor({ createdAt: last.uploadedAt, id: last.id }) : null;

    return NextResponse.json(
      { items, nextCursor, total },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
