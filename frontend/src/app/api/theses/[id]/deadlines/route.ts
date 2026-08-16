// ThèseFacile — GET + POST /api/theses/[id]/deadlines.
//
// "Échéances — Calendrier" + "Ajouter une échéance" (encadrant-only —
// the student doesn't self-assign deadlines in the Banani flow).
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

const CreateBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  dueAt: z.coerce.date(),
  urgency: z.enum(['low', 'medium', 'high']).default('medium'),
  remindEnabled: z.boolean().default(true),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const access = await resolveThesisAccess(prisma, id, auth.user.sub);
    if (access instanceof NextResponse) return access;

    const deadlines = await prisma.deadline.findMany({
      where: { thesisId: id },
      orderBy: [{ dueAt: 'asc' }],
    });

    return NextResponse.json({ items: deadlines }, { headers: { 'x-request-id': ctx.requestId } });
  });
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const access = await resolveThesisAccess(prisma, id, auth.user.sub);
    if (access instanceof NextResponse) return access;
    if (access.encadrantId !== auth.user.sub) {
      return NextResponse.json(
        { error: 'ENCADRANT_ONLY', message: 'Only the encadrant can add deadlines' },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }

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

    const deadline = await prisma.deadline.create({
      data: {
        thesisId: id,
        title: parsed.data.title,
        dueAt: parsed.data.dueAt,
        urgency: parsed.data.urgency,
        remindEnabled: parsed.data.remindEnabled,
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
      },
    });

    try {
      await createNotification(prisma, {
        userId: access.studentId,
        type: 'DEADLINE_ADDED',
        title: 'Nouvelle échéance',
        body: `${parsed.data.title} — ${parsed.data.dueAt.toLocaleDateString('fr-FR')}`,
        data: { thesisId: id, deadlineId: deadline.id },
        dedupeKey: `deadline-added:${deadline.id}`,
      });
    } catch {
      // Notification is best-effort — the deadline is already committed.
    }

    return NextResponse.json(deadline, { status: 201, headers: { 'x-request-id': ctx.requestId } });
  });
}
