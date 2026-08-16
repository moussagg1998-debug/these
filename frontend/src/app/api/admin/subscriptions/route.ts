// GET /api/admin/subscriptions — Admin → Abonnements subscriber list.
// Always filtered to plan='ESSENTIEL' (active + stale-expired-unswept, so
// the admin sees the full picture) — this route is not a general user list.
//
// take: 200, no cursor pagination — same "good enough for v1" precedent as
// GET /api/admin/institutions and GET /api/deadlines: a cross-cutting admin
// aggregate, not an end-user paginated feed. The generic cursor helper in
// lib/server/pagination/paginate.ts is hardcoded to createdAt-descending
// order (see lib/server/notifications/cursor.ts) and doesn't fit
// planExpiresAt-ascending-with-nulls-last; rather than build a bespoke
// cursor codec for one route, this follows the existing precedent instead.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const TAKE = 200;
const Q_MAX = 200;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, Q_MAX).trim();

    const where: Prisma.UserWhereInput = {
      plan: 'ESSENTIEL',
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const items = await prisma.user.findMany({
      where,
      orderBy: [{ planExpiresAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      take: TAKE,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        plan: true,
        planExpiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ items }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
