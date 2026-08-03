// ThèseFacile — GET + PATCH /api/profile.
//
// "Choix du profil" onboarding step. Per the confirmed product decision
// (IMPLEMENTATION-PLAN.md §6): fixed at onboarding, one account = one
// profile. PATCH is therefore a one-shot — once `profileType` is set it
// can't be changed through this route (409 PROFILE_ALREADY_SET).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PatchBody = z.object({
  profileType: z.enum(['ENCADRANT', 'ETUDIANT']),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { profileType: true, institutionId: true, name: true, email: true },
    });

    return NextResponse.json(
      {
        profileType: user?.profileType ?? null,
        institutionId: user?.institutionId ?? null,
        name: user?.name ?? null,
        email: user?.email ?? null,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
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

    const existing = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { profileType: true },
    });
    if (existing?.profileType) {
      return NextResponse.json(
        { error: 'PROFILE_ALREADY_SET', message: 'Profile type is fixed once chosen' },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const user = await prisma.user.update({
      where: { id: auth.user.sub },
      data: { profileType: parsed.data.profileType },
      select: { profileType: true },
    });

    return NextResponse.json(user, { status: 200, headers: { 'x-request-id': ctx.requestId } });
  });
}
