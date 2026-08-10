// "Programmer le dépôt" release cron — Document.scheduledAt is set by
// POST /api/theses/[id]/documents when the student schedules a future
// deposit (file already uploaded to storage; only visibility + the
// DOCUMENT_SUBMITTED notification are deferred). This tick finds rows whose
// time has come, clears scheduledAt (making them ordinary, encadrant-visible
// documents), and fires the same notification the immediate-deposit path
// sends. No outbox needed: like deadline-reminder, this is a read-then-act
// job, not a state change that needs atomic co-commit with anything else.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createLogger } from '@/lib/server/logger';
import { createNotification } from '@/lib/server/notifications';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const log = createLogger();
const LEASE_TTL_MS = 60_000; // ~2 × maxDuration (Pitfall 3)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let released = 0;

    await withLease(redis ?? undefined, 'scheduled-deposits', LEASE_TTL_MS, async () => {
      const due = await prisma.document.findMany({
        where: { scheduledAt: { lte: new Date() } },
        select: {
          id: true,
          chapter: true,
          thesis: { select: { id: true, encadrantId: true } },
        },
      });

      // Sequential, not Promise.all: DATABASE_URL pins connection_limit=1
      // for serverless — same reasoning as /api/reminders and the
      // deadline-reminder cron.
      for (const doc of due) {
        await prisma.document.update({ where: { id: doc.id }, data: { scheduledAt: null } });
        try {
          await createNotification(prisma, {
            userId: doc.thesis.encadrantId,
            type: 'DOCUMENT_SUBMITTED',
            title: 'Nouveau document déposé',
            body: doc.chapter ? `Nouveau dépôt : ${doc.chapter}` : 'Nouveau document déposé',
            data: { thesisId: doc.thesis.id, documentId: doc.id },
            dedupeKey: `document-submitted:${doc.id}`,
          });
        } catch (err) {
          log.warn('scheduled-deposits: notification failed', {
            documentId: doc.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
        released++;
      }

      log.info('scheduled-deposits tick', { released, requestId: ctx.requestId });
    });

    return NextResponse.json(
      { ok: true, released },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
