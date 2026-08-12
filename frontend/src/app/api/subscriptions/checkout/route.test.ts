import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/auth', () => ({
  verifyCsrf: vi.fn(() => null),
}));

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(async () => ({ user: { sub: 'user-1', email: 'me@example.com' } })),
}));

// NOTE: Vitest hoists every `vi.mock()` call above ALL other top-level
// statements in this file (including preceding `const` declarations), and
// only auto-hoists referenced variables whose name contains "mock"
// (case-insensitive) along with it. `lockSpy`, `$transaction`, and
// `prismaOrderUpdate` don't match that heuristic, so referencing them
// directly from a `vi.mock()` factory throws "Cannot access '...' before
// initialization" the moment `./route` is statically imported below (its
// transitive imports resolve these mocked modules before this file's own
// body runs). `vi.hoisted()` is Vitest's documented, name-independent fix:
// it guarantees the wrapped values are assigned before any `vi.mock()`
// factory can observe them. No test behavior/assertions differ from the
// task brief — only this declaration mechanism.
const { lockSpy } = vi.hoisted(() => ({ lockSpy: vi.fn() }));
vi.mock('@/lib/server/subscriptions/lock', () => ({
  lockSubscriptionTx: lockSpy,
}));

const { chargeMock, getChariowProviderMock, executeMock } = vi.hoisted(() => {
  const chargeMock = vi.fn();
  const getChariowProviderMock = vi.fn(() => ({ name: 'chariow', charge: chargeMock }));
  const executeMock = vi.fn(async (fn: () => Promise<unknown>) => fn());
  return { chargeMock, getChariowProviderMock, executeMock };
});
vi.mock('@/lib/server/payments/chariow-singleton', () => ({
  getChariowProvider: getChariowProviderMock,
  chariowBreaker: { execute: executeMock },
  ChariowProviderUnconfiguredError: class ChariowProviderUnconfiguredError extends Error {},
}));

interface MockOrder {
  id: string;
  status: string;
  paymentUrl: string | null;
  metadata: Record<string, unknown> | null;
}

const { txOrder, $transaction, prismaOrderUpdate } = vi.hoisted(() => {
  const txOrder = {
    findFirst: vi.fn(async (_args?: unknown): Promise<MockOrder | null> => null),
    update: vi.fn(async (_args?: unknown) => ({})),
    create: vi.fn(async (_args: { data: Record<string, unknown> }) => ({ id: 'order-1' })),
  };
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ order: txOrder, $executeRawUnsafe: vi.fn() }),
  );
  const prismaOrderUpdate = vi.fn(async () => ({}));
  return { txOrder, $transaction, prismaOrderUpdate };
});
vi.mock('@/lib/server/prisma', () => ({
  prisma: { $transaction, order: { update: prismaOrderUpdate } },
}));

import { requireAuth } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { CircuitOpenError } from '@/lib/server/payments/circuit-breaker';
import { POST } from './route';

function makeReq(body: unknown, opts: { csrf?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.csrf !== false) headers['x-csrf-token'] = 'csrf-tok';
  return new NextRequest('http://test/api/subscriptions/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const validBody = {
  plan: 'ESSENTIEL',
  firstName: 'Ruth',
  lastName: 'Thiala',
  phone: '+221771234567',
  phoneCountry: 'SN',
  phoneLocal: '771234567',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CHARIOW_ESSENTIEL_PRICE_FCFA', '5900');
  vi.mocked(verifyCsrf).mockReturnValue(null);
  vi.mocked(requireAuth).mockResolvedValue({ user: { sub: 'user-1', email: 'me@example.com' } });
  txOrder.findFirst.mockResolvedValue(null);
  txOrder.create.mockResolvedValue({ id: 'order-1' });
  executeMock.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  chargeMock.mockResolvedValue({
    providerChargeId: 'sale_1',
    paymentUrl: 'https://chariow.test/pay/sale_1',
    status: 'PENDING',
    amount: 5900,
    currency: 'XOF',
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/subscriptions/checkout', () => {
  it('creates an Order and returns 201 + paymentUrl on the happy path', async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ orderId: 'order-1', paymentUrl: 'https://chariow.test/pay/sale_1' });
    expect(lockSpy).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(txOrder.create).toHaveBeenCalledOnce();
    const createArgs = txOrder.create.mock.calls[0]![0];
    expect(createArgs.data).toMatchObject({
      userId: 'user-1',
      provider: 'chariow',
      status: 'PENDING',
      amount: 5900,
      currency: 'XOF',
      metadata: { plan: 'ESSENTIEL' },
    });
    expect(prismaOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        providerChargeId: 'sale_1',
        paymentUrl: 'https://chariow.test/pay/sale_1',
        amount: 5900,
        currency: 'XOF',
      },
    });
  });

  it('rejects 400 PHONE_INVALID before ever creating an Order', async () => {
    const res = await POST(makeReq({ ...validBody, phone: 'nope', phoneLocal: '' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('PHONE_INVALID');
    expect(txOrder.create).not.toHaveBeenCalled();
    expect(chargeMock).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED on a malformed body', async () => {
    const res = await POST(makeReq({ plan: 'PREMIUM' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_FAILED');
  });

  it('returns 403 when CSRF fails (checked before auth)', async () => {
    vi.mocked(verifyCsrf).mockReturnValue(
      NextResponse.json({ error: 'CSRF_FAILED' }, { status: 403 }),
    );
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
    expect(requireAuth).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it('supersedes an existing PENDING order that already has a paymentUrl', async () => {
    txOrder.findFirst.mockResolvedValueOnce({
      id: 'order-old',
      status: 'PENDING',
      paymentUrl: 'https://chariow.test/pay/old',
      metadata: { plan: 'ESSENTIEL' },
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    expect(txOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-old' },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(txOrder.create).toHaveBeenCalledOnce();
  });

  it('returns 503 PAYMENT_IN_FLIGHT for an existing PENDING order with no paymentUrl yet (WR-01)', async () => {
    txOrder.findFirst.mockResolvedValueOnce({
      id: 'order-inflight',
      status: 'PENDING',
      paymentUrl: null,
      metadata: { plan: 'ESSENTIEL' },
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PAYMENT_IN_FLIGHT');
    expect(txOrder.update).not.toHaveBeenCalled();
    expect(txOrder.create).not.toHaveBeenCalled();
    expect(chargeMock).not.toHaveBeenCalled();
  });

  it('returns 503 PAYMENT_PROVIDER_UNCONFIGURED when Chariow env is missing', async () => {
    const { ChariowProviderUnconfiguredError } =
      await import('@/lib/server/payments/chariow-singleton');
    getChariowProviderMock.mockImplementationOnce(() => {
      throw new ChariowProviderUnconfiguredError();
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PAYMENT_PROVIDER_UNCONFIGURED');
    expect(txOrder.create).not.toHaveBeenCalled();
  });

  it('returns 503 PAYMENT_PROVIDER_UNAVAILABLE and marks the Order FAILED on CircuitOpenError', async () => {
    const retryAt = new Date(Date.now() + 60_000);
    executeMock.mockImplementationOnce(async () => {
      throw new CircuitOpenError('chariow.charge', retryAt);
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(prismaOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'FAILED' },
    });
  });

  it('returns 502 PAYMENT_FAILED and marks the Order FAILED when charge() throws', async () => {
    chargeMock.mockRejectedValueOnce(new Error('Chariow checkout failed: HTTP 500'));
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('PAYMENT_FAILED');
    expect(prismaOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'FAILED' },
    });
  });

  it('returns 502 PAYMENT_FAILED and does NOT mark the Order FAILED when only the post-charge Order update fails', async () => {
    // charge() succeeded — Chariow already created a live checkout session.
    // If persisting providerChargeId/paymentUrl then fails (e.g. transient
    // DB error), the Order must stay PENDING with no paymentUrl so a retry
    // correctly hits the PAYMENT_IN_FLIGHT guard instead of creating a
    // second, disconnected Chariow session.
    prismaOrderUpdate.mockRejectedValueOnce(new Error('DB write timeout'));
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('PAYMENT_FAILED');
    expect(prismaOrderUpdate).toHaveBeenCalledTimes(1);
    expect(prismaOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        providerChargeId: 'sale_1',
        paymentUrl: 'https://chariow.test/pay/sale_1',
        amount: 5900,
        currency: 'XOF',
      },
    });
    expect(prismaOrderUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });
});
