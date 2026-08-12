import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const orderFindUnique = vi.fn();
const orderFindFirst = vi.fn();
const webhookLogFindUnique = vi.fn();
const webhookLogCreate = vi.fn();
const webhookLogUpdate = vi.fn();

const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    order: { findUnique: orderFindUnique, findFirst: orderFindFirst },
    webhookLog: {
      findUnique: webhookLogFindUnique,
      create: webhookLogCreate,
      update: webhookLogUpdate,
    },
    user: {},
    outboxEvent: {},
  }),
);

vi.mock('@/lib/server/prisma', () => ({
  prisma: { $transaction },
}));

const reconcileCoreMock = vi.fn(async () => 'PAID' as const);
vi.mock('@/lib/server/subscriptions/reconcile', () => ({
  reconcileChariowOrderCore: reconcileCoreMock,
}));

vi.mock('@/lib/server/payments/chariow-singleton', () => ({
  getChariowProvider: vi.fn(() => ({ name: 'chariow' })),
}));

function makeReq(secret: string | null, body: Record<string, unknown>): NextRequest {
  const url = secret
    ? `http://localhost/api/webhooks/chariow?secret=${encodeURIComponent(secret)}`
    : 'http://localhost/api/webhooks/chariow';
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const paidPayload = {
  event_type: 'settled.sale',
  data: { sale_id: 'sale_1', status: 'settled', custom_metadata: { orderId: 'order_1' } },
};

beforeEach(() => {
  vi.stubEnv('CHARIOW_WEBHOOK_SECRET', 'test-secret');
  // `chariowWebhookProvider` (Task 5, not mocked here — this test exercises
  // the real webhook provider's verifySignature/parsePayload/extractIds)
  // lazily constructs the full Chariow provider on first use via
  // `getChariowWebhookProvider()`, which throws ChariowProviderUnconfiguredError
  // unless these two are set, even though verifySignature() itself is a
  // trivial no-op. Same fixture pattern as chariow-singleton.test.ts.
  vi.stubEnv('CHARIOW_API_KEY', 'test-chariow-api-key');
  vi.stubEnv('CHARIOW_PRODUCT_ID_ESSENTIEL', 'test-product-essentiel');
  webhookLogFindUnique.mockResolvedValue(null);
  webhookLogCreate.mockResolvedValue({ id: 'wl1' });
  orderFindUnique.mockResolvedValue({ id: 'order_1', status: 'PENDING', provider: 'chariow' });
  reconcileCoreMock.mockResolvedValue('PAID');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/webhooks/chariow', () => {
  it('returns 401 when the ?secret= query param is missing', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeReq(null, paidPayload));
    expect(res.status).toBe(401);
  });

  it('returns 401 when the ?secret= query param does not match CHARIOW_WEBHOOK_SECRET', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeReq('wrong-secret', paidPayload));
    expect(res.status).toBe(401);
  });

  it('valid secret + settled.sale event resolves the order via custom_metadata.orderId and reconciles', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeReq('test-secret', paidPayload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: false });
    expect(orderFindUnique).toHaveBeenCalledWith({ where: { id: 'order_1' } });
    expect(reconcileCoreMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'order_1' }),
      expect.anything(),
      { pullTimeoutMs: 4_000 },
    );
  });

  it('falls back to providerChargeId lookup when custom_metadata.orderId is absent', async () => {
    orderFindFirst.mockResolvedValueOnce({ id: 'order_2', status: 'PENDING', provider: 'chariow' });
    const { POST } = await import('./route');
    const payload = {
      event_type: 'settled.sale',
      data: { sale_id: 'sale_2', status: 'settled', custom_metadata: {} },
    };
    const res = await POST(makeReq('test-secret', payload));
    expect(res.status).toBe(200);
    expect(orderFindFirst).toHaveBeenCalledWith({
      where: { provider: 'chariow', providerChargeId: 'sale_2' },
    });
  });

  it('replay of the same event returns deduped:true without a second reconcile call', async () => {
    webhookLogFindUnique.mockResolvedValueOnce({ id: 'wl1', processedAt: new Date() });
    const { POST } = await import('./route');
    const res = await POST(makeReq('test-secret', paidPayload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: true });
    expect(reconcileCoreMock).not.toHaveBeenCalled();
  });

  it('unrecognized event type still returns 200 (no retry storm) without reconciling', async () => {
    const { POST } = await import('./route');
    const payload = { event_type: 'sale.pending', data: { sale_id: 'sale_3' } };
    const res = await POST(makeReq('test-secret', payload));
    expect(res.status).toBe(200);
    expect(reconcileCoreMock).not.toHaveBeenCalled();
  });

  it('exports runtime=nodejs and dynamic=force-dynamic', async () => {
    const mod = (await import('./route')) as { runtime?: string; dynamic?: string };
    expect(mod.runtime).toBe('nodejs');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
