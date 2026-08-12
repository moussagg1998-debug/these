// Server-side entitlement gate for route handlers — same shape as
// requireProfileType (frontend/src/lib/server/theses/guards.ts): resolve
// or short-circuit with a NextResponse. Kept out of the protected
// middleware/index.ts for the same reason requireProfileType is: this is a
// product-level (plan) concern, not the generic auth/role primitive that
// file owns.
import 'server-only';
import { NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { hasFeature, type FeatureKey } from './entitlements';

type PrismaLike = PrismaClient | Omit<PrismaClient, '$transaction'>;

/**
 * Always re-fetches `plan`/`planExpiresAt` from the DB — never trusts a JWT
 * claim. The access token carries no plan info: plan changes asynchronously
 * via webhook/cron, independent of the caller's current session.
 */
export async function requireFeature(
  prisma: PrismaLike,
  userId: string,
  feature: FeatureKey,
): Promise<{ plan: string; planExpiresAt: Date | null } | NextResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpiresAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }
  if (!hasFeature(user, feature)) {
    return NextResponse.json(
      {
        error: 'PLAN_UPGRADE_REQUIRED',
        message: 'Cette fonctionnalité nécessite le plan Essentiel.',
        feature,
      },
      { status: 403 },
    );
  }
  return user;
}
