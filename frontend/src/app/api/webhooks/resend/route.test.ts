// POST /api/webhooks/resend — delivery-status webhook (Svix-signed).
//
// Signatures are generated with the REAL Svix algorithm (not mocked away)
// so these tests prove the route actually wires headers into
// resend.webhooks.verify() correctly and that tampering is genuinely
// rejected — verified against the algorithm read directly from
// node_modules/standardwebhooks/dist/index.js (the package resend.webhooks
// delegates to under the hood): secret = base64-decode(strip "whsec_"
// prefix), signedContent = `${msgId}.${timestampSeconds}.${payload}`,
// signature = base64(hmac-sha256(key, signedContent)), header = `v1,<sig>`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

const TEST_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';

function signSvix(msgId: string, timestampSeconds: number, payload: string): string {
  const key = Buffer.from(TEST_SECRET.replace(/^whsec_/, ''), 'base64');
  const toSign = `${msgId}.${timestampSeconds}.${payload}`;
  const sig = crypto.createHmac('sha256', key).update(toSign).digest('base64');
  return `v1,${sig}`;
}

function signedRequest(
  body: Record<string, unknown>,
  opts: { tamper?: boolean } = {},
): NextRequest {
  const payload = JSON.stringify(body);
  const msgId = 'msg_test_' + Math.random().toString(36).slice(2);
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const signature = signSvix(msgId, timestampSeconds, opts.tamper ? payload + 'x' : payload);
  return new NextRequest('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'svix-id': msgId,
      'svix-timestamp': String(timestampSeconds),
      'svix-signature': signature,
    },
    body: payload,
  });
}

const webhookLogFindUnique = vi.fn();
const webhookLogCreate = vi.fn();
const webhookLogUpdate = vi.fn();
const emailJobUpdateMany = vi.fn();

const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    webhookLog: {
      findUnique: webhookLogFindUnique,
      create: webhookLogCreate,
      update: webhookLogUpdate,
    },
    emailJob: { updateMany: emailJobUpdateMany },
  }),
);

vi.mock('@/lib/server/prisma', () => ({
  prisma: { $transaction },
}));

beforeEach(() => {
  vi.stubEnv('RESEND_WEBHOOK_SECRET', TEST_SECRET);
  webhookLogFindUnique.mockReset().mockResolvedValue(null);
  webhookLogCreate.mockReset();
  webhookLogUpdate.mockReset();
  emailJobUpdateMany.mockReset().mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/webhooks/resend', () => {
  it('returns 503 when RESEND_WEBHOOK_SECRET is not configured', async () => {
    vi.unstubAllEnvs();
    const { POST } = await import('./route');
    const res = await POST(signedRequest({ type: 'email.delivered', data: { email_id: 'e1' } }));
    expect(res.status).toBe(503);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('returns 401 when Svix headers are missing', async () => {
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'e1' } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('returns 401 when the signature does not match the payload (tampered body)', async () => {
    const { POST } = await import('./route');
    const req = signedRequest(
      { type: 'email.delivered', data: { email_id: 'e1' } },
      { tamper: true },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('valid email.delivered marks the matching EmailJob DELIVERED and logs the WebhookLog row', async () => {
    const { POST } = await import('./route');
    const req = signedRequest({
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: { email_id: 'resend-abc-123' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: false });

    expect(webhookLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: 'resend', eventType: 'email.delivered' }),
      }),
    );
    expect(emailJobUpdateMany).toHaveBeenCalledWith({
      where: { resendId: 'resend-abc-123' },
      data: { deliveryStatus: 'DELIVERED', deliveryStatusAt: expect.any(Date) },
    });
  });

  it('valid email.bounced marks the matching EmailJob BOUNCED', async () => {
    const { POST } = await import('./route');
    const req = signedRequest({
      type: 'email.bounced',
      data: { email_id: 'resend-abc-456' },
    });
    await POST(req);
    expect(emailJobUpdateMany).toHaveBeenCalledWith({
      where: { resendId: 'resend-abc-456' },
      data: { deliveryStatus: 'BOUNCED', deliveryStatusAt: expect.any(Date) },
    });
  });

  it('unrecognized event types (e.g. email.opened) are acknowledged 200 without touching EmailJob', async () => {
    const { POST } = await import('./route');
    const req = signedRequest({ type: 'email.opened', data: { email_id: 'resend-xyz' } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(emailJobUpdateMany).not.toHaveBeenCalled();
    // Still logged for idempotency tracking, same as every other event type.
    expect(webhookLogCreate).toHaveBeenCalled();
  });

  it('no EmailJob row matches resendId -> still 200, no crash', async () => {
    emailJobUpdateMany.mockResolvedValueOnce({ count: 0 });
    const { POST } = await import('./route');
    const req = signedRequest({ type: 'email.delivered', data: { email_id: 'unknown-id' } });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('replay of the same svix-id + event type is deduped and does not re-mutate EmailJob', async () => {
    webhookLogFindUnique.mockResolvedValueOnce({ id: 'wl1', processedAt: new Date() });
    const { POST } = await import('./route');
    const req = signedRequest({ type: 'email.delivered', data: { email_id: 'resend-abc-123' } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: true });
    expect(webhookLogCreate).not.toHaveBeenCalled();
    expect(emailJobUpdateMany).not.toHaveBeenCalled();
  });
});

describe('source invariants', () => {
  it("route source contains runtime='nodejs', dynamic='force-dynamic', and withRequestContext", async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
    expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
    expect(src).toContain('withRequestContext');
  });
});
