// ADMIN — POST /api/admin/users/[id]/reset-password
//
// Admin-triggered equivalent of POST /api/auth/forgot-password: issues a
// PASSWORD_RESET VerificationCode + queues the reset email via the outbox,
// inside one transaction with the audit-log write (all-or-nothing — no
// email can go out without a matching AdminAction row, and vice versa).
//
// Mirrors forgot-password's semantics exactly: does NOT bump the target's
// tokenVersion (sessions stay alive until the user actually completes the
// reset, same as the self-service flow) and does NOT reveal anything about
// password state — this route is admin-authenticated so there's no
// enumeration concern to guard against here.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf, generateVerificationCode } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enqueueOutbox } from '@/lib/server/outbox';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { clientIp } from '@/lib/server/middleware/rate-limit-by-email';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const VERIFICATION_TTL_MS = Number(process.env.AUTH_VERIFICATION_TTL_MIN ?? 15) * 60 * 1000;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const { id } = await ctx.params;
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await prisma.$transaction(async (tx) => {
      await tx.verificationCode.create({
        data: {
          userId: target.id,
          code,
          type: 'PASSWORD_RESET',
          expiresAt,
        },
      });
      await enqueueOutbox(tx, {
        kind: 'email.password_reset',
        payload: {
          to: target.email,
          code,
          expiresAt: expiresAt.toISOString(),
        },
      });
      const userAgent = req.headers.get('user-agent');
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'user.password_reset',
        targetType: 'User',
        targetId: target.id,
        ip: clientIp(req),
        ...(userAgent ? { userAgent } : {}),
      });
    });

    return NextResponse.json({ ok: true }, { headers: { 'x-request-id': reqCtx.requestId } });
  });
}
