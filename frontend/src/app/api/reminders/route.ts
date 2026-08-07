// ThèseFacile — POST /api/reminders.
//
// "Rappels groupés" (Banani `new_screen8.jsx`) — encadrant-only bulk send.
// Top-level cross-thesis route, same convention as /api/messages,
// /api/deadlines (aggregates live top-level, not nested under
// /api/theses/[id]).
//
// Deliberately reuses the existing Message + Notification models instead of
// a new "Reminder" table (see .planning/banani/phase-16-rappels-groupes.md):
// every send creates a real Message row so the reminder actually shows up
// in the student's /messages thread, regardless of which channels are
// checked. "Notification in-app" / "Email" only control whether a
// Notification and/or email additionally fire.
//
// Email goes straight through the EmailQueue singleton (no outbox) — the
// email-queue-drain cron drains ANY pending EmailJob regardless of who
// enqueued it, so there's no need to round-trip through outbox/dispatcher.ts
// for a route with no other DB row that needs atomic-commit with the email.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { requireProfileType } from '@/lib/server/theses/guards';
import { createNotification } from '@/lib/server/notifications';
import { getEmailQueue } from '@/lib/server/queues/email-queue-singleton';
import { reminderEmail } from '@/lib/server/theses/reminder-email';
import { displayName } from '@/lib/theses';
import { createLogger } from '@/lib/server/logger';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const log = createLogger();

const Body = z.object({
  thesisIds: z.array(z.string().min(1)).min(1, 'Sélectionnez au moins un destinataire').max(50),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  channels: z.object({ email: z.boolean(), inApp: z.boolean() }).refine((c) => c.email || c.inApp, {
    message: "Sélectionnez au moins un canal d'envoi",
  }),
});

/** Accent-insensitive {{prénom}} substitution — matches {{prenom}}, {{ prénom }}, etc. */
function personalize(body: string, firstName: string): string {
  return body.replace(/\{\{\s*pr[ée]nom\s*\}\}/gi, firstName);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const profile = await requireProfileType(prisma, auth.user.sub, ['ENCADRANT']);
    if (profile instanceof NextResponse) return profile;

    const parsed = Body.safeParse(await req.json().catch(() => null));
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
    const { thesisIds, subject, body, channels } = parsed.data;

    const encadrant = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { name: true, email: true },
    });
    const encadrantName = encadrant?.name || encadrant?.email || 'Votre encadrant';

    // Scoping via the where-clause silently drops any id the caller doesn't
    // own — same "don't leak existence" posture as resolveThesisAccess.
    const theses = await prisma.thesis.findMany({
      where: { id: { in: thesisIds }, encadrantId: auth.user.sub, archivedAt: null },
      select: {
        id: true,
        student: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    if (theses.length === 0) {
      return NextResponse.json(
        { error: 'NO_VALID_RECIPIENTS', message: 'No matching students found' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const emailQueue = channels.email ? getEmailQueue() : null;
    if (channels.email && !emailQueue) {
      log.warn('reminders: email channel requested but email queue not configured');
    }

    const recipients: { thesisId: string; studentId: string; studentName: string }[] = [];

    // Sequential, not Promise.all: DATABASE_URL pins connection_limit=1 for
    // serverless — see GET /api/theses's identical comment (Phase 14 lesson).
    for (const thesis of theses) {
      const name = displayName(thesis.student);
      const firstName = name.split(' ')[0] ?? name;
      const personalizedBody = personalize(body, firstName);

      const message = await prisma.message.create({
        data: {
          thesisId: thesis.id,
          senderId: auth.user.sub,
          body: personalizedBody,
        },
      });

      if (channels.inApp) {
        try {
          await createNotification(prisma, {
            userId: thesis.student.id,
            type: 'REMINDER',
            title: subject.slice(0, 140),
            body: personalizedBody.slice(0, 140),
            data: { thesisId: thesis.id, messageId: message.id },
            dedupeKey: `reminder:${message.id}`,
          });
        } catch {
          // Notification is best-effort — the message is already committed.
        }
      }

      if (channels.email && emailQueue) {
        try {
          const tpl = reminderEmail({ subject, body: personalizedBody, encadrantName });
          await emailQueue.enqueue({
            to: thesis.student.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
        } catch (err) {
          log.warn('reminders: email enqueue failed', {
            thesisId: thesis.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }

      recipients.push({ thesisId: thesis.id, studentId: thesis.student.id, studentName: name });
    }

    return NextResponse.json(
      { sent: recipients.length, recipients },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
