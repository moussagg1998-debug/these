// ThèseFacile — GET + POST /api/theses/[id]/messages.
//
// "Messagerie étudiant-encadrant". MVP decision (IMPLEMENTATION-PLAN.md §6):
// periodic refetch, not real-time — no Ably wiring here. The client is
// expected to poll GET on an interval; upgrading to Ably later only
// requires adding a publish() call after the POST commits.
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
  body: z.string().trim().min(1).max(5000),
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

    const messages = await prisma.message.findMany({
      where: { thesisId: id },
      orderBy: [{ createdAt: 'asc' }],
    });

    return NextResponse.json({ items: messages }, { headers: { 'x-request-id': ctx.requestId } });
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

    const message = await prisma.message.create({
      data: {
        thesisId: id,
        senderId: auth.user.sub,
        body: parsed.data.body,
      },
    });

    const recipientId = access.studentId === auth.user.sub ? access.encadrantId : access.studentId;
    try {
      await createNotification(prisma, {
        userId: recipientId,
        type: 'MESSAGE_RECEIVED',
        title: 'Nouveau message',
        body: parsed.data.body.slice(0, 140),
        data: { thesisId: id, messageId: message.id },
        dedupeKey: `message-received:${message.id}`,
      });
    } catch {
      // Notification is best-effort — the message is already committed.
    }

    return NextResponse.json(message, { status: 201, headers: { 'x-request-id': ctx.requestId } });
  });
}
