// Admin — Sécurité — aggregate KPI counts for the /admin/security dashboard.
// Mirrors email-stats/route.ts's exact pattern: sequential prisma.count()
// calls (Neon connection_limit=1), requireAdmin('ADMIN') + rate limit, a
// fixed reporting window.
//
// `activeAccounts24h` is an honestly-labeled approximation ("Comptes actifs
// (24h)") — this app has no session store (stateless JWT, no revocation
// list beyond tokenVersion), so true concurrent-session data does not
// exist. Distinct accounts with a LOGIN_SUCCESS in the window is the
// closest real signal, and the UI must label it as such rather than imply
// it counts live sessions.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { prisma } from '@/lib/server/prisma';
import { countAnomalies } from '@/lib/server/security/anomalies';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const WINDOW_HOURS = 24;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const since = new Date(Date.now() - WINDOW_MS);

    // Sequential — Neon's DATABASE_URL pins connection_limit=1 (same
    // rationale as every other multi-query admin route in this repo).
    const adminLogins24h = await prisma.securityEvent.count({
      where: {
        type: 'LOGIN_SUCCESS',
        createdAt: { gte: since },
        user: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
      },
    });
    const failedLogins24h = await prisma.securityEvent.count({
      where: { type: 'LOGIN_FAILED', createdAt: { gte: since } },
    });
    const passwordChanges24h = await prisma.securityEvent.count({
      where: { type: 'PASSWORD_CHANGED', createdAt: { gte: since } },
    });
    const activeAccountRows = await prisma.securityEvent.findMany({
      where: { type: 'LOGIN_SUCCESS', createdAt: { gte: since }, userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    });
    const anomalies = await countAnomalies(prisma);

    return NextResponse.json(
      {
        windowHours: WINDOW_HOURS,
        adminLogins24h,
        failedLogins24h,
        passwordChanges24h,
        activeAccounts24h: activeAccountRows.length,
        unusualActivityCount: anomalies,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
