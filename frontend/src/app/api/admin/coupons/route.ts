// GET/POST /api/admin/coupons — Admin → Coupons back-office CRUD (list +
// create). Mirrors the established admin-route guard order (requireAdmin →
// rate limit → Zod → mutation → logAdminAction) from
// api/admin/users/[id]/status/route.ts. Coupons are few (expected: low
// dozens) — no search/cursor pagination, same "aggregate, not a paginated
// feed" precedent as GET /api/admin/institutions.
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
import { normalizeCouponCode } from '@/lib/server/subscriptions/coupons';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const CreateBody = z.object({
  code: z.string().trim().min(3).max(40),
  discountPercent: z.number().int().min(1).max(100),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.coerce.date().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { redemptions: true } } },
    });

    const items = coupons.map((c) => ({
      id: c.id,
      code: c.code,
      discountPercent: c.discountPercent,
      isActive: c.isActive,
      maxRedemptions: c.maxRedemptions,
      redemptionCount: c._count.redemptions,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ items }, { headers: { 'x-request-id': ctx.requestId } });
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid request body',
          issues: parsed.error.issues,
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const code = normalizeCouponCode(parsed.data.code);

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: 'COUPON_CODE_TAKEN', message: 'A coupon with this code already exists' },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    let coupon;
    try {
      coupon = await prisma.$transaction(async (tx) => {
        const created = await tx.coupon.create({
          data: {
            code,
            discountPercent: parsed.data.discountPercent,
            maxRedemptions: parsed.data.maxRedemptions ?? null,
            expiresAt: parsed.data.expiresAt ?? null,
          },
        });
        const userAgent = req.headers.get('user-agent');
        await logAdminAction(tx, {
          actorId: auth.admin.id,
          action: 'coupon.create',
          targetType: 'Coupon',
          targetId: created.id,
          metadata: {
            code: created.code,
            discountPercent: created.discountPercent,
            maxRedemptions: created.maxRedemptions,
            expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
          },
          ip: clientIp(req),
          ...(userAgent ? { userAgent } : {}),
        });
        return created;
      });
    } catch (err) {
      // Race fallback — the pre-check above closes almost every window, but
      // a genuine concurrent create on the same code still hits the unique
      // constraint. Same duck-typed Prisma error check as api/theses/route.ts.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2002'
      ) {
        return NextResponse.json(
          { error: 'COUPON_CODE_TAKEN', message: 'A coupon with this code already exists' },
          { status: 409, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      throw err;
    }

    return NextResponse.json(
      { coupon },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
