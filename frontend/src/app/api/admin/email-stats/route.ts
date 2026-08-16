// Admin — Monitoring des emails — aggregate KPI counts for the
// /admin/emails dashboard. Pairs with the existing per-row browser at
// GET /api/admin/email-queue (OBS-02) — this route reports counts only,
// never full html/text (same PII discipline).
//
// `delivered`/`bounced` are real, webhook-confirmed signals — POST
// /api/webhooks/resend flips EmailJob.deliveryStatus on the matching row
// when Resend calls back. Until that webhook is configured in the Resend
// dashboard (RESEND_WEBHOOK_SECRET set + a webhook endpoint created there),
// `deliveryStatus` stays null on every row and these counts legitimately
// read 0 — that's the truthful state, not a bug: this route only reports
// what has actually been confirmed, per CLAUDE.md's monitoring invariant
// against fabricating unverified statuses (see the sibling
// lib/server/monitoring/checks/resend.ts doc comment, which draws the same
// line for the 8-service health center).
//
// `verification`/`passwordReset` breakdown is derived from `EmailJob.subject`
// (VERIFICATION_SUBJECT/PASSWORD_RESET_SUBJECT below) because EmailJob itself
// has no `kind`/`type` column — that classification lives one layer up on
// OutboxEvent.kind and isn't persisted onto the EmailJob row it produces. If
// the email copy in lib/server/auth/email-templates.ts is ever localized,
// update these constants to match — an unmatched subject just falls out of
// both buckets rather than crashing.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h — matches the "Emails récents" reading window
const WINDOW_HOURS = 24;

const VERIFICATION_SUBJECT = 'Verify your email'; // must match auth/email-templates.ts verificationEmail()
const PASSWORD_RESET_SUBJECT = 'Reset your password'; // must match auth/email-templates.ts resetPasswordEmail()

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
    const sent = await prisma.emailJob.count({
      where: { status: 'SENT', sentAt: { gte: since } },
    });
    const delivered = await prisma.emailJob.count({
      where: { deliveryStatus: 'DELIVERED', deliveryStatusAt: { gte: since } },
    });
    const bounced = await prisma.emailJob.count({
      where: { deliveryStatus: 'BOUNCED', deliveryStatusAt: { gte: since } },
    });
    const failed = await prisma.emailJob.count({
      where: { status: { in: ['FAILED', 'DEAD'] }, scheduledAt: { gte: since } },
    });
    const pending = await prisma.emailJob.count({ where: { status: 'PENDING' } });
    const verification = await prisma.emailJob.count({
      where: { subject: VERIFICATION_SUBJECT, createdAt: { gte: since } },
    });
    const passwordReset = await prisma.emailJob.count({
      where: { subject: PASSWORD_RESET_SUBJECT, createdAt: { gte: since } },
    });

    const attempted = sent + failed;
    const failureRatePct = attempted > 0 ? Math.round((failed / attempted) * 1000) / 10 : 0;

    return NextResponse.json(
      {
        windowHours: WINDOW_HOURS,
        sent,
        delivered,
        bounced,
        failed,
        pending,
        verification,
        passwordReset,
        failureRatePct,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
