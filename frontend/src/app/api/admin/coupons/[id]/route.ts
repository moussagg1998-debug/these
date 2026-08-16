// PATCH /api/admin/coupons/[id] — modify discount/cap/expiry or toggle
// isActive. `code` is intentionally never accepted here (immutable after
// creation — it's a public-facing identifier that may already be shared
// with users). Mirrors api/admin/users/[id]/status/route.ts's before/after
// logAdminAction pattern.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { clientIp } from '@/lib/server/middleware/rate-limit-by-email';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z
  .object({
    discountPercent: z.number().int().min(1).max(100).optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | {
      kind: 'OK';
      coupon: {
        id: string;
        code: string;
        discountPercent: number;
        isActive: boolean;
        maxRedemptions: number | null;
        expiresAt: Date | null;
      };
    };

export async function PATCH(
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
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const before = await tx.coupon.findUnique({ where: { id } });
      if (!before) return { kind: 'NOT_FOUND' as const };

      const updated = await tx.coupon.update({
        where: { id },
        data: {
          ...(parsed.data.discountPercent !== undefined && {
            discountPercent: parsed.data.discountPercent,
          }),
          ...(parsed.data.maxRedemptions !== undefined && {
            maxRedemptions: parsed.data.maxRedemptions,
          }),
          ...(parsed.data.expiresAt !== undefined && { expiresAt: parsed.data.expiresAt }),
          ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        },
      });

      const userAgent = req.headers.get('user-agent');
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'coupon.update',
        targetType: 'Coupon',
        targetId: id,
        metadata: {
          from: {
            discountPercent: before.discountPercent,
            maxRedemptions: before.maxRedemptions,
            expiresAt: before.expiresAt ? before.expiresAt.toISOString() : null,
            isActive: before.isActive,
          },
          to: {
            discountPercent: updated.discountPercent,
            maxRedemptions: updated.maxRedemptions,
            expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
            isActive: updated.isActive,
          },
        },
        ip: clientIp(req),
        ...(userAgent ? { userAgent } : {}),
      });

      return { kind: 'OK' as const, coupon: updated };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'COUPON_NOT_FOUND', message: 'Coupon not found' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }
    return NextResponse.json(
      { coupon: result.coupon },
      { status: 200, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
