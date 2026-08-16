// ThèseFacile — GET + PATCH /api/profile.
//
// "Choix du profil" onboarding step. Per the confirmed product decision
// (IMPLEMENTATION-PLAN.md §6): fixed at onboarding, one account = one
// profile. `profileType` is therefore a one-shot — once set it can't be
// changed through this route (409 PROFILE_ALREADY_SET).
//
// Phase 10 widened PATCH to also accept the encadrant "Profil" tab's fields
// (name/department/academicGrade/specialties/bio) — these are NOT onboarding-
// gated and update unconditionally regardless of profileType state. Only a
// request that actually includes `profileType` is subject to the one-shot
// check below.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { DATE_FORMAT_VALUES, LOCALE_VALUES, TIMEZONE_VALUES } from '@/lib/datePreferences';

const PatchBody = z
  .object({
    profileType: z.enum(['ENCADRANT', 'ETUDIANT']).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    department: z.string().trim().max(200).optional(),
    academicGrade: z.string().trim().max(200).optional(),
    specialties: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    bio: z.string().trim().max(1000).optional(),
    // Set via Settings → camera button, after POST /api/upload returns a
    // Cloudinary secure_url — same pattern OAuth first-sign-in already uses.
    avatarUrl: z.string().trim().url().max(2000).optional(),
    // Settings → "Général" display preferences.
    locale: z.enum(LOCALE_VALUES).optional(),
    timezone: z.enum(TIMEZONE_VALUES).optional(),
    dateFormat: z.enum(DATE_FORMAT_VALUES).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: {
        profileType: true,
        institutionId: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        avatarUrl: true,
        department: true,
        academicGrade: true,
        specialties: true,
        bio: true,
        institution: { select: { id: true, name: true } },
        locale: true,
        timezone: true,
        dateFormat: true,
      },
    });

    return NextResponse.json(
      {
        profileType: user?.profileType ?? null,
        institutionId: user?.institutionId ?? null,
        name: user?.name ?? null,
        email: user?.email ?? null,
        emailVerified: user?.emailVerifiedAt != null,
        avatarUrl: user?.avatarUrl ?? null,
        department: user?.department ?? null,
        academicGrade: user?.academicGrade ?? null,
        specialties: user?.specialties ?? [],
        bio: user?.bio ?? null,
        institution: user?.institution ?? null,
        locale: user?.locale ?? 'fr',
        timezone: user?.timezone ?? 'Africa/Dakar',
        dateFormat: user?.dateFormat ?? 'long',
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

    if (parsed.data.profileType !== undefined) {
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
    }

    const {
      profileType,
      name,
      department,
      academicGrade,
      specialties,
      bio,
      avatarUrl,
      locale,
      timezone,
      dateFormat,
    } = parsed.data;
    const user = await prisma.user.update({
      where: { id: auth.user.sub },
      data: {
        ...(profileType !== undefined ? { profileType } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(academicGrade !== undefined ? { academicGrade } : {}),
        ...(specialties !== undefined ? { specialties } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(locale !== undefined ? { locale } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(dateFormat !== undefined ? { dateFormat } : {}),
      },
      select: {
        profileType: true,
        name: true,
        department: true,
        academicGrade: true,
        specialties: true,
        bio: true,
        avatarUrl: true,
        locale: true,
        timezone: true,
        dateFormat: true,
      },
    });

    return NextResponse.json(user, { status: 200, headers: { 'x-request-id': ctx.requestId } });
  });
}
