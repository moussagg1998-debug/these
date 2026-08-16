import { describe, it, expect, vi } from 'vitest';
import type { CouponReadClient } from './coupons';
import { normalizeCouponCode, computeDiscountedAmount, validateCoupon } from './coupons';

function makeClient(
  overrides: {
    coupon?: unknown;
    redemptionCount?: number;
    existingRedemption?: unknown;
  } = {},
): CouponReadClient {
  return {
    coupon: {
      findUnique: vi.fn(async () => overrides.coupon ?? null),
    },
    couponRedemption: {
      count: vi.fn(async () => overrides.redemptionCount ?? 0),
      findUnique: vi.fn(async () => overrides.existingRedemption ?? null),
    },
  } as unknown as CouponReadClient;
}

const activeCoupon = {
  id: 'coupon_1',
  code: 'THESIS',
  discountPercent: 95,
  isActive: true,
  maxRedemptions: null,
  expiresAt: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
};

describe('normalizeCouponCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeCouponCode('  thesis  ')).toBe('THESIS');
  });
});

describe('computeDiscountedAmount', () => {
  it('computes the discounted amount', () => {
    expect(computeDiscountedAmount(5900, 95)).toBe(295);
  });

  it('rounds a non-integer result (defensive — Order.amount is an Int column)', () => {
    expect(computeDiscountedAmount(999, 33)).toBe(Math.round((999 * 67) / 100));
  });
});

describe('validateCoupon', () => {
  it('returns COUPON_NOT_FOUND when the code does not exist', async () => {
    const client = makeClient({ coupon: null });
    const result = await validateCoupon(client, 'NOPE', 'user_1');
    expect(result).toEqual({ ok: false, error: 'COUPON_NOT_FOUND' });
  });

  it('returns COUPON_INACTIVE when isActive is false', async () => {
    const client = makeClient({ coupon: { ...activeCoupon, isActive: false } });
    const result = await validateCoupon(client, 'THESIS', 'user_1');
    expect(result).toEqual({ ok: false, error: 'COUPON_INACTIVE' });
  });

  it('returns COUPON_EXPIRED when expiresAt is in the past', async () => {
    const client = makeClient({ coupon: { ...activeCoupon, expiresAt: new Date('2020-01-01') } });
    const result = await validateCoupon(client, 'THESIS', 'user_1');
    expect(result).toEqual({ ok: false, error: 'COUPON_EXPIRED' });
  });

  it('does not treat a null expiresAt as expired', async () => {
    const client = makeClient({ coupon: activeCoupon });
    const result = await validateCoupon(client, 'THESIS', 'user_1');
    expect(result.ok).toBe(true);
  });

  it('returns COUPON_MAX_REDEMPTIONS once the cap is reached', async () => {
    const client = makeClient({
      coupon: { ...activeCoupon, maxRedemptions: 2 },
      redemptionCount: 2,
    });
    const result = await validateCoupon(client, 'THESIS', 'user_1');
    expect(result).toEqual({ ok: false, error: 'COUPON_MAX_REDEMPTIONS' });
  });

  it('allows redemption when the cap has not been reached', async () => {
    const client = makeClient({
      coupon: { ...activeCoupon, maxRedemptions: 2 },
      redemptionCount: 1,
    });
    const result = await validateCoupon(client, 'THESIS', 'user_1');
    expect(result.ok).toBe(true);
  });

  it('does not count redemptions when maxRedemptions is null (unlimited)', async () => {
    const client = makeClient({ coupon: activeCoupon });
    await validateCoupon(client, 'THESIS', 'user_1');
    expect(client.couponRedemption.count).not.toHaveBeenCalled();
  });

  it('returns COUPON_ALREADY_USED when this user already redeemed it', async () => {
    const client = makeClient({
      coupon: activeCoupon,
      existingRedemption: { id: 'redemption_1' },
    });
    const result = await validateCoupon(client, 'THESIS', 'user_1');
    expect(result).toEqual({ ok: false, error: 'COUPON_ALREADY_USED' });
  });

  it('checks redemption uniqueness for THIS user, scoped by coupon id', async () => {
    const client = makeClient({ coupon: activeCoupon });
    await validateCoupon(client, 'THESIS', 'user_42');
    expect(client.couponRedemption.findUnique).toHaveBeenCalledWith({
      where: { couponId_userId: { couponId: 'coupon_1', userId: 'user_42' } },
    });
  });

  it('returns ok:true with the coupon row when every check passes', async () => {
    const client = makeClient({ coupon: activeCoupon });
    const result = await validateCoupon(client, 'THESIS', 'user_1');
    expect(result).toEqual({ ok: true, coupon: activeCoupon });
  });
});
