// GET /api/subscriptions/status — read-only plan status for the Settings
// "Abonnement" tab. No CSRF check (read-only, GET).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { prisma } from '@/lib/server/prisma';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { plan: true, planExpiresAt: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const latestOrder = await prisma.order.findFirst({
      where: { userId: auth.user.sub, provider: 'chariow' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, amount: true, currency: true, paidAt: true },
    });

    return NextResponse.json(
      { plan: user.plan, planExpiresAt: user.planExpiresAt, latestOrder: latestOrder ?? null },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
