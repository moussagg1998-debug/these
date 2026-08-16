// Admin — Sécurité — paginated, filterable read of SecurityEvent rows.
// Same cursor-pagination shape as audit-log/route.ts.
//
// Filters:
//   ?type    — exact match on LOGIN_SUCCESS | LOGIN_FAILED | PASSWORD_CHANGED
//   ?email   — exact match (lowercased)
//   ?since   — ISO 8601 string → createdAt >= since
//   ?until   — ISO 8601 string → createdAt <= until
//   ?cursor  — opaque base64 cursor from a prior page's nextCursor
//   ?limit   — 1..50 (default 20)
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const VALID_TYPES: ReadonlySet<string> = new Set([
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'PASSWORD_CHANGED',
]);

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const typeParam = url.searchParams.get('type');
    const type = typeParam && VALID_TYPES.has(typeParam) ? typeParam : null;
    const email = url.searchParams.get('email');
    const since = parseDate(url.searchParams.get('since'));
    const until = parseDate(url.searchParams.get('until'));
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const createdAtFilter: Prisma.DateTimeFilter | undefined =
      since || until
        ? {
            ...(since ? { gte: since } : {}),
            ...(until ? { lte: until } : {}),
          }
        : undefined;

    const where: Prisma.SecurityEventWhereInput = {
      ...(type ? { type } : {}),
      ...(email ? { email: email.trim().toLowerCase() } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...cursorWhere(cursor),
    };

    const rows = await prisma.securityEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        type: true,
        userId: true,
        email: true,
        ip: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
    });

    return NextResponse.json(buildPage(rows, limit), {
      headers: { 'x-request-id': ctx.requestId },
    });
  });
}
