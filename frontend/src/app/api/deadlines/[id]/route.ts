// ThèseFacile — PATCH /api/deadlines/[id].
//
// Toggles `completedAt` from the "Échéances — Calendrier" screen — lets the
// encadrant mark a deadline the student has genuinely met so it stops
// showing as "En retard" once its due date passes. Encadrant-only, same
// authority model as PATCH /api/comments/[id] (resolved is the encadrant's
// own triage call, not self-reported by the student). Top-level route (not
// nested under /api/theses/[id]) because the cross-thesis calendar
// shouldn't need to know which thesis a deadline belongs to just to toggle
// it — same rationale as /api/comments/[id].
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { createNotification } from '@/lib/server/notifications';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PatchBody = z.object({
  completed: z.boolean(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const deadline = await prisma.deadline.findUnique({ where: { id } });
    if (!deadline) {
      return NextResponse.json(
        { error: 'DEADLINE_NOT_FOUND', message: 'Deadline not found' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const access = await resolveThesisAccess(prisma, deadline.thesisId, auth.user.sub);
    if (access instanceof NextResponse) return access;
    if (access.encadrantId !== auth.user.sub) {
      return NextResponse.json(
        { error: 'ENCADRANT_ONLY', message: 'Only the encadrant can validate a deadline' },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }

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

    const updated = await prisma.deadline.update({
      where: { id },
      data: { completedAt: parsed.data.completed ? new Date() : null },
    });

    if (parsed.data.completed) {
      try {
        await createNotification(prisma, {
          userId: access.studentId,
          type: 'DEADLINE_COMPLETED',
          title: 'Échéance validée',
          body: `Votre encadrant a marqué « ${updated.title} » comme respectée.`,
          data: { thesisId: deadline.thesisId, deadlineId: updated.id },
          dedupeKey: `deadline-completed:${updated.id}`,
        });
      } catch {
        // Notification is best-effort — the deadline is already committed.
      }
    }

    return NextResponse.json(updated, { headers: { 'x-request-id': ctx.requestId } });
  });
}
