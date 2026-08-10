// ADMIN-01 — GET /api/admin/users/[id] (detail).
//
// Sequence: makeRequestContext → withRequestContext → requireAdmin('ADMIN')
// → enforceAdminRateLimit → prisma.user.findUnique with the same PII-safe
// USER_SELECT shape as the list endpoint (plus profile fields the detail
// view needs). 404 on miss with stable code USER_NOT_FOUND.
//
// `lastActivityAt` is derived, not stored — the schema has no
// lastLoginAt/lastActiveAt column. We take the max of the target's most
// recent Message/Comment/FileUpload/Thesis touch. Queries run sequentially
// (Neon connection_limit=1 convention — no Promise.all).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  profileType: true,
  institution: { select: { name: true } },
  department: true,
  academicGrade: true,
  specialties: true,
  bio: true,
} as const satisfies Prisma.UserSelect;

async function deriveLastActivityAt(userId: string): Promise<string | null> {
  const timestamps: Date[] = [];

  const lastMessage = await prisma.message.findFirst({
    where: { senderId: userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (lastMessage) timestamps.push(lastMessage.createdAt);

  const lastComment = await prisma.comment.findFirst({
    where: { authorId: userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (lastComment) timestamps.push(lastComment.createdAt);

  const lastUpload = await prisma.fileUpload.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (lastUpload) timestamps.push(lastUpload.createdAt);

  const lastThesisTouch = await prisma.thesis.findFirst({
    where: { OR: [{ studentId: userId }, { encadrantId: userId }] },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });
  if (lastThesisTouch) timestamps.push(lastThesisTouch.updatedAt);

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps.map((d) => d.getTime()))).toISOString();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const { id } = await ctx.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const lastActivityAt = await deriveLastActivityAt(id);

    return NextResponse.json(
      { user: { ...user, lastActivityAt } },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
