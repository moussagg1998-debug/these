// Resend delivery-status webhook — the real signal behind "Délivrés"/
// "Rebonds" on the Admin → Monitoring des emails page.
//
// Deliberately NOT built on top of lib/server/webhook/handler.ts
// (createWebhookHandler): that factory's dispatch surface is
// onPaid/onRefunded/onFailed — a payment-webhook vocabulary. Resend's
// delivery events (delivered/bounced/complained/delayed) don't map onto
// "paid or refunded" without abusing the abstraction, so this route
// hand-rolls the same invariants instead (raw body read before parsing,
// signature verified before trusting anything, WebhookLog dedup) without
// forcing a payment-shaped contract onto a non-payment event.
//
// Idempotency reuses the generic WebhookLog model exactly like the Bictorys
// webhook does (`provider` + `@@unique([externalId, eventType])`), keyed on
// the Svix `svix-id` header — Svix's own documented idempotency key for
// exactly this purpose (retried deliveries reuse the same svix-id).
//
// Correlation: `data.email_id` is the id Resend returned from the original
// `emails.send()` call, captured onto EmailJob.resendId at send time
// (queues/email-queue.ts). Rows sent before this feature shipped have
// resendId=null and are silently skipped — there is nothing to correlate
// them to.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { Resend } from 'resend';
import { prisma } from '@/lib/server/prisma';
import { createLogger } from '@/lib/server/logger';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const logger = createLogger();

// Maps Resend's delivery-status event types onto EmailJob.deliveryStatus.
// Engagement/lifecycle events we don't track here (email.sent, .opened,
// .clicked, .scheduled, .received, .suppressed, .failed) fall through to
// "unhandled" — 200 OK, no row mutated, matches Resend's expectation that
// unrecognized event types are acknowledged, not rejected.
const DELIVERY_STATUS_BY_EVENT: Record<string, string> = {
  'email.delivered': 'DELIVERED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
  'email.delivery_delayed': 'DELAYED',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('resend webhook received but RESEND_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'RESEND_WEBHOOK_NOT_CONFIGURED' },
        { status: 503, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    // Raw text BEFORE any parsing — required for signature verification to
    // match what Resend actually signed (same invariant as every other
    // webhook route in this codebase).
    const payload = await req.text();
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: 'Missing Svix headers' },
        { status: 401, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    let event: { type: string; data: { email_id: string } };
    try {
      // resend.webhooks.verify() is pure HMAC verification — it never makes
      // a network call — but the `Resend` constructor itself unconditionally
      // throws when it has no key (checking both the arg and RESEND_API_KEY).
      // Reuse RESEND_API_KEY if it's configured (the common case — sending
      // and verifying both need Resend); fall back to a syntactically valid
      // placeholder otherwise so verification doesn't hard-depend on the
      // sending key existing.
      const client = new Resend(process.env.RESEND_API_KEY || 're_000000000000000000000000000000');
      event = client.webhooks.verify({
        payload,
        headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
        webhookSecret,
      }) as { type: string; data: { email_id: string } };
    } catch (err) {
      logger.warn('resend webhook signature verification failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const deliveryStatus = DELIVERY_STATUS_BY_EVENT[event.type];

    let deduped = false;
    await prisma.$transaction(async (tx) => {
      const existing = await tx.webhookLog.findUnique({
        where: { externalId_eventType: { externalId: svixId, eventType: event.type } },
        select: { id: true, processedAt: true },
      });

      if (existing?.processedAt) {
        deduped = true;
        return;
      }

      if (!existing) {
        await tx.webhookLog.create({
          data: {
            provider: 'resend',
            externalId: svixId,
            eventType: event.type,
            payload: event as unknown as Prisma.InputJsonValue,
          },
        });
      }

      if (deliveryStatus) {
        const updated = await tx.emailJob.updateMany({
          where: { resendId: event.data.email_id },
          data: { deliveryStatus, deliveryStatusAt: new Date() },
        });
        if (updated.count === 0) {
          logger.warn('resend webhook: no EmailJob matched resendId', {
            emailId: event.data.email_id,
            type: event.type,
          });
        }
      }

      await tx.webhookLog.update({
        where: { externalId_eventType: { externalId: svixId, eventType: event.type } },
        data: { processedAt: new Date() },
      });
    });

    return NextResponse.json(
      { ok: true, deduped },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
