/**
 * Entitlements — single source of truth for what each plan can access.
 * Mirrors the real, existing pricing table (`PLANS` in
 * `frontend/src/app/page.tsx`): Gratuit = 2 étudiants, no rappels groupés.
 * Essentiel = 20 étudiants, rappels groupés. A data-driven map, not
 * scattered `plan === 'ESSENTIEL'` checks across routes/pages.
 */

export type FeatureKey = 'BULK_REMINDERS';
export type UserPlan = 'FREE' | 'ESSENTIEL';

interface PlanUser {
  plan: string;
  planExpiresAt: Date | null;
}

const PLAN_LIMITS: Record<UserPlan, { features: FeatureKey[]; maxStudents: number }> = {
  FREE: { features: [], maxStudents: 2 },
  ESSENTIEL: { features: ['BULK_REMINDERS'], maxStudents: 20 },
};

/**
 * Computes the plan actually in effect right now — not the possibly-stale
 * `plan` column. `subscription-expiration` only sweeps every 5 minutes (see
 * `frontend/vercel.json`), so a user whose `planExpiresAt` has already
 * passed can still have `plan = "ESSENTIEL"` in the row. Every entitlement
 * check must compare against `now()` here rather than trust `plan` alone,
 * or a user gets bonus Essentiel access on every single check until the
 * next sweep, not just once.
 */
export function effectivePlan(user: PlanUser): UserPlan {
  const isActiveEssentiel =
    user.plan === 'ESSENTIEL' && (!user.planExpiresAt || user.planExpiresAt > new Date());
  return isActiveEssentiel ? 'ESSENTIEL' : 'FREE';
}

export function hasFeature(user: PlanUser, feature: FeatureKey): boolean {
  return PLAN_LIMITS[effectivePlan(user)].features.includes(feature);
}

export function maxStudents(user: PlanUser): number {
  return PLAN_LIMITS[effectivePlan(user)].maxStudents;
}
