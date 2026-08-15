import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { seedAdmin } from '@/test-utils/admin-fixtures';

mockNextCookies();

vi.mock('@/lib/server/auth', () => ({ verifyCsrf: vi.fn(() => null) }));
vi.mock('@/lib/server/middleware', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({ enforceAdminRateLimit: vi.fn() }));

import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { PATCH } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockEnforceAdminRateLimit = vi.mocked(enforceAdminRateLimit);

const admin = seedAdmin({ id: 'admin-1', email: 'admin@test.local' });
const adminCtx = {
  user: { sub: admin.id, email: admin.email },
  admin: { id: admin.id, email: admin.email, role: 'ADMIN' as const },
};

const couponRow = {
  id: 'coupon-1',
  code: 'THESIS',
  discountPercent: 95,
  isActive: true,
  maxRedemptions: null,
  expiresAt: null,
  createdAt: new Date('2026-08-14T00:00:00Z'),
  updatedAt: new Date('2026-08-14T00:00:00Z'),
};

function makePatch(body: unknown): NextRequest {
  return new NextRequest('http://test/api/admin/coupons/coupon-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-tok' },
    body: JSON.stringify(body),
  });
}

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  vi.mocked(verifyCsrf).mockReturnValue(null);
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
  prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
    typeof fn === 'function' ? fn(prismaMock) : fn,
  );
  prismaMock.coupon.findUnique.mockResolvedValue(couponRow as never);
  prismaMock.coupon.update.mockResolvedValue({ ...couponRow, isActive: false } as never);
});

describe('PATCH /api/admin/coupons/[id]', () => {
  it('deactivates a coupon and logs the before/after state', async () => {
    const res = await PATCH(makePatch({ isActive: false }), ctxFor('coupon-1'));
    expect(res.status).toBe(200);
    expect(prismaMock.coupon.update).toHaveBeenCalledWith({
      where: { id: 'coupon-1' },
      data: { isActive: false },
    });
    expect(prismaMock.adminAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'coupon.update',
          metadata: expect.objectContaining({
            from: expect.objectContaining({ isActive: true }),
            to: expect.objectContaining({ isActive: false }),
          }),
        }),
      }),
    );
  });

  it('updates discountPercent, maxRedemptions, and expiresAt together', async () => {
    const expiresAt = new Date('2026-12-31T00:00:00Z');
    await PATCH(
      makePatch({ discountPercent: 50, maxRedemptions: 100, expiresAt: expiresAt.toISOString() }),
      ctxFor('coupon-1'),
    );
    expect(prismaMock.coupon.update).toHaveBeenCalledWith({
      where: { id: 'coupon-1' },
      data: { discountPercent: 50, maxRedemptions: 100, expiresAt },
    });
  });

  it('ignores an unknown "code" field — code is immutable', async () => {
    await PATCH(makePatch({ code: 'OTHER', isActive: false }), ctxFor('coupon-1'));
    const updateArgs = prismaMock.coupon.update.mock.calls[0]?.[0];
    expect(updateArgs?.data).not.toHaveProperty('code');
  });

  it('returns 404 COUPON_NOT_FOUND for a nonexistent id', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce(null);
    const res = await PATCH(makePatch({ isActive: false }), ctxFor('nope'));
    expect(res.status).toBe(404);
    expect(prismaMock.coupon.update).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED when the body has no recognized fields', async () => {
    const res = await PATCH(makePatch({}), ctxFor('coupon-1'));
    expect(res.status).toBe(400);
  });

  it('returns 403 when CSRF fails', async () => {
    vi.mocked(verifyCsrf).mockReturnValue(
      NextResponse.json({ error: 'CSRF_FAILED' }, { status: 403 }),
    );
    const res = await PATCH(makePatch({ isActive: false }), ctxFor('coupon-1'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await PATCH(makePatch({ isActive: false }), ctxFor('coupon-1'));
    expect(res.status).toBe(403);
  });
});
