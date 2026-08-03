// ThèseFacile domain guards — shared by every /api/theses* route.
//
// Not part of the protected middleware/index.ts (CLAUDE.md keeps that file
// to generic auth/role primitives). `profileType` is a product-level field
// separate from the admin `role` enum, so it gets its own small guard here,
// modeled on the requireAdmin / requireOrgRole shape (return NextResponse to
// short-circuit, or the resolved context).
import 'server-only';
import { NextResponse } from 'next/server';
import type { PrismaClient, Thesis } from '@prisma/client';

export type ProfileType = 'ENCADRANT' | 'ETUDIANT';

type PrismaLike = PrismaClient | Omit<PrismaClient, '$transaction'>;

/**
 * Resolve the caller's profileType and enforce it's one of `allowed`.
 * - profileType null (onboarding incomplete) → 403 PROFILE_NOT_SET
 * - profileType set but not in `allowed` → 403 PROFILE_TYPE_FORBIDDEN
 */
export async function requireProfileType(
  prisma: PrismaLike,
  userId: string,
  allowed: ProfileType[],
): Promise<{ profileType: ProfileType } | NextResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileType: true },
  });
  const profileType = user?.profileType as ProfileType | null | undefined;
  if (!profileType) {
    return NextResponse.json(
      { error: 'PROFILE_NOT_SET', message: 'Complete profile onboarding first' },
      { status: 403 },
    );
  }
  if (!allowed.includes(profileType)) {
    return NextResponse.json(
      { error: 'PROFILE_TYPE_FORBIDDEN', message: 'Not allowed for this profile type' },
      { status: 403 },
    );
  }
  return { profileType };
}

/**
 * Load a Thesis and verify `userId` is either its student or its encadrant.
 * Returns 404 (not 403) on a thesis that exists but belongs to someone else
 * — same "don't leak existence" posture as requireOrgRole for non-members.
 */
export async function resolveThesisAccess(
  prisma: PrismaLike,
  thesisId: string,
  userId: string,
): Promise<Thesis | NextResponse> {
  const thesis = await prisma.thesis.findUnique({ where: { id: thesisId } });
  if (!thesis || (thesis.studentId !== userId && thesis.encadrantId !== userId)) {
    return NextResponse.json({ error: 'THESIS_NOT_FOUND' }, { status: 404 });
  }
  return thesis;
}
