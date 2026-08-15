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
const { lockSpy, lockCouponSpy } = vi.hoisted(() => ({ lockSpy: vi.fn(), lockCouponSpy: vi.fn() }));
vi.mock('@/lib/server/subscriptions/lock', () => ({
  lockSubscriptionTx: lockSpy,
  lockCouponTx: lockCouponSpy,
}));

const { normalizeCouponCodeMock, validateCouponMock, computeDiscountedAmountMock } = vi.hoisted(
  () => ({
    normalizeCouponCodeMock: vi.fn((s: string) => s.trim().toUpperCase()),
    validateCouponMock: vi.fn(),
    computeDiscountedAmountMock: vi.fn((amount: number, pct: number) =>
      Math.round((amount * (100 - pct)) / 100),
    ),
  }),
);
vi.mock('@/lib/server/subscriptions/coupons', () => ({
  normalizeCouponCode: normalizeCouponCodeMock,
  validateCoupon: validateCouponMock,
  computeDiscountedAmount: computeDiscountedAmountMock,
}));

const { activatePlanFromOrderMock } = vi.hoisted(() => ({
  activatePlanFromOrderMock: vi.fn(async () => ({
    planExpiresAt: new Date('2026-09-11T00:00:00Z'),
  })),
}));
vi.mock('@/lib/server/subscriptions/activate', () => ({
  activatePlanFromOrder: activatePlanFromOrderMock,
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

const { txOrder, txCouponRedemption, $transaction, prismaOrderUpdate } = vi.hoisted(() => {
  const txOrder = {
    findFirst: vi.fn(async (_args?: unknown): Promise<MockOrder | null> => null),
    update: vi.fn(async (_args?: unknown) => ({})),
    create: vi.fn(async (_args: { data: Record<string, unknown> }) => ({ id: 'order-1' })),
  };
  const txCouponRedemption = {
    create: vi.fn(async (_args?: unknown) => ({ id: 'redemption-1' })),
  };
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ order: txOrder, couponRedemption: txCouponRedemption, $executeRawUnsafe: vi.fn() }),
  );
  const prismaOrderUpdate = vi.fn(async () => ({}));
  return { txOrder, txCouponRedemption, $transaction, prismaOrderUpdate };
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
  txCouponRedemption.create.mockResolvedValue({ id: 'redemption-1' });
  validateCouponMock.mockResolvedValue({
    ok: true,
    coupon: {
      id: 'coupon-1',
      code: 'THESIS',
      discountPercent: 95,
      isActive: true,
      maxRedemptions: null,
      expiresAt: null,
    },
  });
  activatePlanFromOrderMock.mockResolvedValue({ planExpiresAt: new Date('2026-09-11T00:00:00Z') });
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

  it('rounds a non-integer amount from the provider response before persisting (Order.amount is an Int column)', async () => {
    chargeMock.mockResolvedValueOnce({
      providerChargeId: 'sale_1',
      paymentUrl: 'https://chariow.test/pay/sale_1',
      amount: 5900.4,
      currency: 'XOF',
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
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

describe('POST /api/subscriptions/checkout — with a coupon code', () => {
  const bodyWithCoupon = { ...validBody, couponCode: 'thesis' };

  it('bypasses Chariow entirely and returns a PAID order with the discount breakdown', async () => {
    const res = await POST(makeReq(bodyWithCoupon));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      orderId: 'order-1',
      paymentUrl: null,
      coupon: { code: 'THESIS', discountPercent: 95, originalAmount: 5900, finalAmount: 295 },
      plan: 'ESSENTIEL',
      planExpiresAt: '2026-09-11T00:00:00.000Z',
    });
    expect(getChariowProviderMock).not.toHaveBeenCalled();
    expect(chargeMock).not.toHaveBeenCalled();
  });

  it('normalizes the code, then locks user and coupon before validating', async () => {
    await POST(makeReq(bodyWithCoupon));
    expect(normalizeCouponCodeMock).toHaveBeenCalledWith('thesis');
    expect(lockSpy).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(lockCouponSpy).toHaveBeenCalledWith(expect.anything(), 'THESIS');
    expect(validateCouponMock).toHaveBeenCalledWith(expect.anything(), 'THESIS', 'user-1');
  });

  it('creates the Order as PAID with provider "coupon" and the discounted amount', async () => {
    await POST(makeReq(bodyWithCoupon));
    const createArgs = txOrder.create.mock.calls[0]![0];
    expect(createArgs.data).toMatchObject({
      userId: 'user-1',
      provider: 'coupon',
      status: 'PAID',
      amount: 295,
      currency: 'XOF',
      metadata: {
        plan: 'ESSENTIEL',
        couponCode: 'THESIS',
        originalAmount: 5900,
        discountPercent: 95,
      },
    });
    expect(createArgs.data.paidAt).toBeInstanceOf(Date);
  });

  it('creates a CouponRedemption row linking the coupon, user, and order', async () => {
    await POST(makeReq(bodyWithCoupon));
    expect(txCouponRedemption.create).toHaveBeenCalledWith({
      data: { couponId: 'coupon-1', userId: 'user-1', orderId: 'order-1' },
    });
  });

  it('activates the plan via the shared helper', async () => {
    await POST(makeReq(bodyWithCoupon));
    expect(activatePlanFromOrderMock).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      orderId: 'order-1',
      plan: 'ESSENTIEL',
    });
  });

  it.each([
    ['COUPON_NOT_FOUND'],
    ['COUPON_INACTIVE'],
    ['COUPON_EXPIRED'],
    ['COUPON_MAX_REDEMPTIONS'],
    ['COUPON_ALREADY_USED'],
  ])('returns 422 %s and creates nothing when validation fails', async (error) => {
    validateCouponMock.mockResolvedValueOnce({ ok: false, error });
    const res = await POST(makeReq(bodyWithCoupon));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe(error);
    expect(txOrder.create).not.toHaveBeenCalled();
    expect(txCouponRedemption.create).not.toHaveBeenCalled();
    expect(activatePlanFromOrderMock).not.toHaveBeenCalled();
  });

  it('never calls the Chariow provider lookup for a coupon checkout', async () => {
    await POST(makeReq(bodyWithCoupon));
    expect(getChariowProviderMock).not.toHaveBeenCalled();
  });
});
