// Admin monitoring center — POST /api/cron/monitoring-check (every 2 min).
//
// Runs the 8-service sweep (frontend/src/lib/server/monitoring/run-checks.ts)
// under a leader-lease so overlapping ticks can't double-count consecutive
// failures. See CLAUDE.md's cron inventory and Files-SHOULD-modify list —
// mirrors the exact shape of the other 8 cron routes (verifyCronSecret,
// withRequestContext, maxDuration).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 8 sequential checks × ≤6s per-check timeout, bounded well under 60s

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { runMonitoringChecksLeased } from '@/lib/server/monitoring/run-checks';
import { createLogger } from '@/lib/server/logger';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const log = createLogger();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const summaries = await runMonitoringChecksLeased();
    log.info('monitoring-check tick', { requestId: ctx.requestId, summaries });

    return NextResponse.json(
      { ok: true, summaries },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
