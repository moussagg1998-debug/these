import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

const { validateCouponMock } = vi.hoisted(() => ({ validateCouponMock: vi.fn() }));
vi.mock('@/lib/server/subscriptions/coupons', () => ({
  normalizeCouponCode: (s: string) => s.trim().toUpperCase(),
  validateCoupon: validateCouponMock,
  computeDiscountedAmount: (amount: number, pct: number) =>
    Math.round((amount * (100 - pct)) / 100),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CHARIOW_ESSENTIEL_PRICE_FCFA', '5900');
  vi.mocked(requireAuth).mockResolvedValue({ user: { sub: 'user-1', email: 'me@example.com' } });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/subscriptions/coupon-preview', () => {
  it('returns valid:true with the discount breakdown for a valid coupon', async () => {
    validateCouponMock.mockResolvedValue({
      ok: true,
      coupon: { id: 'coupon-1', code: 'THESIS', discountPercent: 95 },
    });
    const res = await GET(makeGet('http://test/api/subscriptions/coupon-preview?code=thesis'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      valid: true,
      code: 'THESIS',
      discountPercent: 95,
      originalAmount: 5900,
      finalAmount: 295,
    });
    expect(validateCouponMock).toHaveBeenCalledWith(expect.anything(), 'THESIS', 'user-1');
  });

  it('returns valid:false with the reason for an invalid coupon', async () => {
    validateCouponMock.mockResolvedValue({ ok: false, error: 'COUPON_EXPIRED' });
    const res = await GET(makeGet('http://test/api/subscriptions/coupon-preview?code=OLD'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false, reason: 'COUPON_EXPIRED' });
  });

  it('returns valid:false COUPON_NOT_FOUND without calling validateCoupon for an empty code', async () => {
    const res = await GET(makeGet('http://test/api/subscriptions/coupon-preview?code='));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false, reason: 'COUPON_NOT_FOUND' });
    expect(validateCouponMock).not.toHaveBeenCalled();
  });

  it('never mutates anything — no create/update called on the mocked Prisma client', async () => {
    validateCouponMock.mockResolvedValue({
      ok: true,
      coupon: { id: 'coupon-1', code: 'THESIS', discountPercent: 95 },
    });
    await GET(makeGet('http://test/api/subscriptions/coupon-preview?code=THESIS'));
    expect(prismaMock.coupon.create).not.toHaveBeenCalled();
    expect(prismaMock.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await GET(makeGet('http://test/api/subscriptions/coupon-preview?code=THESIS'));
    expect(res.status).toBe(401);
  });
});
