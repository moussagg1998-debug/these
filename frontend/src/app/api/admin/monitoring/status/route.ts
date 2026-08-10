// GET /api/admin/monitoring/status — Admin → Monitoring's 8-card grid data
// source. Read-only snapshot of MonitoringServiceStatus + open-incident
// counts; never runs a live check itself (that's the cron / check-now's
// job) so loading this page never has a request block on 8 outbound calls.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { getStatusSummary } from '@/lib/server/monitoring/status-summary';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const summary = await getStatusSummary();

    return NextResponse.json(summary, { headers: { 'x-request-id': ctx.requestId } });
  });
}
