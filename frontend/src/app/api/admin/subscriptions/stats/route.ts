// GET /api/admin/subscriptions/stats — Admin → Abonnements KPI row.
// Mirrors GET /api/admin/stats exactly in shape: requireAdmin → rate limit →
// sequential prisma.user.count calls (never Promise.all — DATABASE_URL pins
// connection_limit=1 for Neon serverless; see institutions/route.ts's note).
//
// essentielActive / essentielExpiredUnswept boundary matches
// lib/server/subscriptions/entitlements.ts's effectivePlan() exactly:
// planExpiresAt null OR in the future = active. Everything else with
// plan='ESSENTIEL' is stale, not yet caught by the 5-minute expiration cron.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { expectedPriceFcfa } from '@/lib/server/subscriptions/plans';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const now = new Date();

    const essentielActive = await prisma.user.count({
      where: {
        plan: 'ESSENTIEL',
        OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }],
      },
    });
    const essentielExpiredUnswept = await prisma.user.count({
      where: { plan: 'ESSENTIEL', planExpiresAt: { lte: now } },
    });
    const free = await prisma.user.count({ where: { plan: { not: 'ESSENTIEL' } } });

    const mrrFcfa = essentielActive * expectedPriceFcfa('ESSENTIEL');

    return NextResponse.json(
      { essentielActive, essentielExpiredUnswept, free, mrrFcfa },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
