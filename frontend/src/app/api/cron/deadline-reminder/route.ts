// Settings → Notifications → "Rappels d'échéances" (3 jours avant une
// échéance critique). Scans Deadline.dueAt for the [now, now+3d] window and
// notifies each deadline's encadrant — at most once per deadline, since
// Notification.dedupeKey is deterministic per-deadline (not per-run), so
// re-running this cron while a deadline stays inside the window is a no-op
// (P2002 caught by createNotification). No outbox needed: this is a
// read-then-notify job, not a state change that needs atomic co-commit with
// anything else (same reasoning as /api/reminders — see its file header).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createLogger } from '@/lib/server/logger';
import { createNotification } from '@/lib/server/notifications';
import { isChannelEnabled, type NotificationPrefs } from '@/lib/server/notifications/prefs-merge';
import { getEmailQueue } from '@/lib/server/queues/email-queue-singleton';
import { deadlineReminderEmail } from '@/lib/server/theses/deadline-reminder-email';
import { displayName } from '@/lib/theses';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const log = createLogger();
const LEASE_TTL_MS = 120_000; // ~2 × maxDuration (Pitfall 3)
const WINDOW_DAYS = 3;
const EVENT_TYPE = 'DEADLINE_REMINDER';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let notified = 0;
    let processed = 0;

    await withLease(redis ?? undefined, 'deadline-reminder', LEASE_TTL_MS, async () => {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const deadlines = await prisma.deadline.findMany({
        where: {
          dueAt: { gte: now, lte: windowEnd },
          remindEnabled: true,
          thesis: { archivedAt: null },
        },
        select: {
          id: true,
          title: true,
          dueAt: true,
          thesis: {
            select: {
              id: true,
              topic: true,
              encadrantId: true,
              student: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { dueAt: 'asc' },
      });
      processed = deadlines.length;

      const emailQueue = getEmailQueue();
      // Cache per-encadrant user + prefs rows across deadlines in this run —
      // several deadlines commonly share the same encadrant.
      const encadrantCache = new Map<
        string,
        { name: string | null; email: string; timezone: string; prefs: NotificationPrefs }
      >();

      // Sequential, not Promise.all: DATABASE_URL pins connection_limit=1 for
      // serverless — same reasoning as /api/reminders and GET /api/theses.
      for (const deadline of deadlines) {
        const encadrantId = deadline.thesis.encadrantId;
        let encadrant = encadrantCache.get(encadrantId);
        if (!encadrant) {
          const [user, prefsRow] = await Promise.all([
            prisma.user.findUnique({
              where: { id: encadrantId },
              select: { name: true, email: true, timezone: true },
            }),
            prisma.notificationPreferences.findUnique({
              where: { userId: encadrantId },
              select: { prefs: true },
            }),
          ]);
          if (!user) continue;
          const rawPrefs = prefsRow?.prefs;
          const prefs: NotificationPrefs =
            rawPrefs && typeof rawPrefs === 'object' && !Array.isArray(rawPrefs)
              ? (rawPrefs as NotificationPrefs)
              : {};
          encadrant = { name: user.name, email: user.email, timezone: user.timezone, prefs };
          encadrantCache.set(encadrantId, encadrant);
        }

        const studentName = displayName(deadline.thesis.student);
        const daysUntilDue = Math.ceil(
          (deadline.dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );

        if (isChannelEnabled(encadrant.prefs, EVENT_TYPE, 'inApp')) {
          try {
            const created = await createNotification(prisma, {
              userId: encadrantId,
              type: EVENT_TYPE,
              title: 'Échéance à venir',
              body: `${deadline.title} — ${studentName} (dans ${daysUntilDue <= 0 ? "aujourd'hui" : `${daysUntilDue} j`})`,
              data: { thesisId: deadline.thesis.id, deadlineId: deadline.id },
              dedupeKey: `deadline-reminder:${deadline.id}`,
            });
            if (created) notified++;
          } catch (err) {
            log.warn('deadline-reminder: notification failed', {
              deadlineId: deadline.id,
              err: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (emailQueue && isChannelEnabled(encadrant.prefs, EVENT_TYPE, 'email')) {
          try {
            const dueAtLabel = deadline.dueAt.toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: encadrant.timezone,
            });
            const tpl = deadlineReminderEmail({
              encadrantName: encadrant.name || encadrant.email,
              studentName,
              thesisTopic: deadline.thesis.topic,
              deadlineTitle: deadline.title,
              dueAtLabel,
              daysUntilDue,
            });
            await emailQueue.enqueue({
              to: encadrant.email,
              subject: tpl.subject,
              html: tpl.html,
              text: tpl.text,
            });
          } catch (err) {
            log.warn('deadline-reminder: email enqueue failed', {
              deadlineId: deadline.id,
              err: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      log.info('deadline-reminder tick', { processed, notified, requestId: ctx.requestId });
    });

    return NextResponse.json(
      { ok: true, processed, notified },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
