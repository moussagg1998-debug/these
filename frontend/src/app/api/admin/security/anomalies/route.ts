// Admin — Sécurité — GET the currently-triggered anomaly flags. Computed
// live from SecurityEvent by lib/server/security/anomalies.ts — no
// persisted "flag" table, so this always reflects current data with no
// staleness risk.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { prisma } from '@/lib/server/prisma';
import { detectAnomalies } from '@/lib/server/security/anomalies';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const anomalies = await detectAnomalies(prisma);

    return NextResponse.json({ anomalies }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
