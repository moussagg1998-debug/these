// POST /api/webhooks/chariow?secret=... — Chariow "Pulse" webhook.
//
// Chariow.md invariants honored:
//   §7 — Chariow has no body signature; the shared secret is in the URL
//     query string, compared in constant time. This file reads ONLY
//     `req.nextUrl.searchParams` — never the body — before delegating to
//     the PROTECTED `createWebhookHandler` factory, which owns raw-body
//     reading for byte-identical processing.
//   §7 — "Zéro confiance dans le corps": onPaid never credits from the
//     payload directly — it calls reconcileChariowOrderCore, which re-pulls
//     GET /sales/{id} before trusting anything.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import 'server-only';
import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createWebhookHandler } from '@/lib/server/webhook/handler';
import { chariowWebhookProvider, type ChariowWebhookPayload } from '@/lib/server/webhook/chariow';
import { getChariowProvider } from '@/lib/server/payments/chariow-singleton';
import { reconcileChariowOrderCore } from '@/lib/server/subscriptions/reconcile';
import { prisma } from '@/lib/server/prisma';

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const handler = createWebhookHandler<ChariowWebhookPayload>({
  prisma,
  provider: chariowWebhookProvider,

  async onPaid(payload, tx) {
    const orderId = payload.data?.custom_metadata?.orderId;
    const saleId = String(payload.data?.sale_id ?? payload.data?.id ?? '');

    const order = orderId
      ? await tx.order.findUnique({ where: { id: orderId } })
      : saleId
        ? await tx.order.findFirst({ where: { provider: 'chariow', providerChargeId: saleId } })
        : null;
    if (!order) return {}; // unknown order — nothing to reconcile

    const chariowProvider = getChariowProvider();
    // 4s cap — subscriptions/reconcile.ts's header comment explains why:
    // this runs inside the webhook factory's own Serializable transaction,
    // which must not be held open longer than Prisma's default interactive
    // transaction timeout.
    await reconcileChariowOrderCore(tx, order, chariowProvider, { pullTimeoutMs: 4_000 });
    return {};
  },
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CHARIOW_WEBHOOK_SECRET ?? '';
  const presented = req.nextUrl.searchParams.get('secret') ?? '';
  if (!secret || !presented || !timingSafeStringEqual(presented, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  return handler(req);
}
