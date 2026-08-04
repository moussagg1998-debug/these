// ThèseFacile — GET /api/messages.
//
// "Messagerie — Côté Encadrant" (Banani `new_screen7.jsx`) — a cross-thesis
// inbox aggregate, unlike GET /api/theses/[id]/messages which is scoped to
// one thesis (the shape the student-side thread view needs). Encadrant-only,
// same "not cursor-paginated, take: 200" idiom as GET /api/deadlines
// (Phase 5) — an encadrant's thesis count is bounded, unlike message volume.
//
// Per-thesis unread count is derived from the existing MESSAGE_RECEIVED
// notifications (already created by POST /api/theses/[id]/messages since
// Phase 1) rather than a new Message.readAt column — one query, grouped by
// data.thesisId in application code, no N+1.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { requireProfileType } from '@/lib/server/theses/guards';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

// Safety-net cap on the unread-notification scan, not true pagination — see
// .planning/banani/phase-11-encadrant-messaging.md § Deliberate simplifications.
const UNREAD_NOTIFICATION_SCAN_LIMIT = 500;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const profile = await requireProfileType(prisma, auth.user.sub, ['ENCADRANT']);
    if (profile instanceof NextResponse) return profile;

    const theses = await prisma.thesis.findMany({
      where: { encadrantId: auth.user.sub },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      include: {
        student: { select: { id: true, name: true, email: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        deadlines: { where: { dueAt: { gte: new Date() } }, orderBy: { dueAt: 'asc' }, take: 1 },
        documents: { orderBy: { uploadedAt: 'desc' }, take: 2 },
      },
    });

    const unreadNotifications = await prisma.notification.findMany({
      where: { userId: auth.user.sub, type: 'MESSAGE_RECEIVED', readAt: null },
      select: { id: true, data: true },
      take: UNREAD_NOTIFICATION_SCAN_LIMIT,
    });

    const unreadByThesis = new Map<string, string[]>();
    for (const n of unreadNotifications) {
      const thesisId = (n.data as { thesisId?: string } | null)?.thesisId;
      if (!thesisId) continue;
      const ids = unreadByThesis.get(thesisId) ?? [];
      ids.push(n.id);
      unreadByThesis.set(thesisId, ids);
    }

    const items = theses.map((thesis) => {
      const unreadNotificationIds = unreadByThesis.get(thesis.id) ?? [];
      return {
        thesis: {
          id: thesis.id,
          topic: thesis.topic,
          progress: thesis.progress,
          student: thesis.student,
        },
        lastMessage: thesis.messages[0] ?? null,
        unreadCount: unreadNotificationIds.length,
        unreadNotificationIds,
        nextDeadline: thesis.deadlines[0] ?? null,
        recentDocuments: thesis.documents,
      };
    });

    return NextResponse.json({ items }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
