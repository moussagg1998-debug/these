// POST /api/admin/monitoring/check-now — "Vérifier maintenant" manual
// trigger. SUPERADMIN-only (not plain ADMIN) because it makes 8 real
// outbound calls on demand — gated higher than the read-only status/
// incidents routes to bound how often that can be triggered. Audited via
// logAdminAction like every other back-office mutation.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireSuperadmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { clientIp } from '@/lib/server/middleware/rate-limit-by-email';
import { logAdminAction } from '@/lib/server/admin/audit';
import { runMonitoringChecks } from '@/lib/server/monitoring/run-checks';
import { getStatusSummary } from '@/lib/server/monitoring/status-summary';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireSuperadmin();
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const summaries = await runMonitoringChecks();

    const userAgent = req.headers.get('user-agent');
    await logAdminAction(prisma, {
      actorId: auth.admin.id,
      action: 'monitoring.check_now',
      metadata: { summaries },
      ip: clientIp(req),
      ...(userAgent ? { userAgent } : {}),
    });

    const summary = await getStatusSummary();

    return NextResponse.json(summary, { headers: { 'x-request-id': ctx.requestId } });
  });
}
