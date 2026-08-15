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
import { GET, POST } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockEnforceAdminRateLimit = vi.mocked(enforceAdminRateLimit);

const admin = seedAdmin({ id: 'admin-1', email: 'admin@test.local' });
const adminCtx = {
  user: { sub: admin.id, email: admin.email },
  admin: { id: admin.id, email: admin.email, role: 'ADMIN' as const },
};

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://test/api/admin/coupons', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-tok' },
    body: JSON.stringify(body),
  });
}

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

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  vi.mocked(verifyCsrf).mockReturnValue(null);
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
  prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
    typeof fn === 'function' ? fn(prismaMock) : fn,
  );
});

describe('GET /api/admin/coupons', () => {
  it('returns the coupon list with a derived redemptionCount', async () => {
    prismaMock.coupon.findMany.mockResolvedValue([
      { ...couponRow, _count: { redemptions: 12 } },
    ] as never);
    const res = await GET(makeGet('http://test/api/admin/coupons'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([
      {
        id: 'coupon-1',
        code: 'THESIS',
        discountPercent: 95,
        isActive: true,
        maxRedemptions: null,
        redemptionCount: 12,
        expiresAt: null,
        createdAt: couponRow.createdAt.toISOString(),
      },
    ]);
  });

  it('returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet('http://test/api/admin/coupons'));
    expect(res.status).toBe(403);
    expect(prismaMock.coupon.findMany).not.toHaveBeenCalled();
  });

  it('returns 429 when the admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet('http://test/api/admin/coupons'));
    expect(res.status).toBe(429);
  });
});

describe('POST /api/admin/coupons', () => {
  it('creates a coupon, normalizes the code, and logs the admin action', async () => {
    prismaMock.coupon.findUnique.mockResolvedValue(null);
    prismaMock.coupon.create.mockResolvedValue(couponRow as never);
    const res = await POST(makePost({ code: 'thesis', discountPercent: 95 }));
    expect(res.status).toBe(201);
    expect(prismaMock.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'THESIS' } });
    expect(prismaMock.coupon.create).toHaveBeenCalledWith({
      data: { code: 'THESIS', discountPercent: 95, maxRedemptions: null, expiresAt: null },
    });
    expect(prismaMock.adminAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: 'admin-1', action: 'coupon.create' }),
      }),
    );
  });

  it('accepts an explicit null maxRedemptions/expiresAt (what CouponFormModal actually sends for an unset cap/expiry, not an omitted key)', async () => {
    prismaMock.coupon.findUnique.mockResolvedValue(null);
    prismaMock.coupon.create.mockResolvedValue(couponRow as never);
    const res = await POST(
      makePost({ code: 'thesis', discountPercent: 95, maxRedemptions: null, expiresAt: null }),
    );
    expect(res.status).toBe(201);
    expect(prismaMock.coupon.create).toHaveBeenCalledWith({
      data: { code: 'THESIS', discountPercent: 95, maxRedemptions: null, expiresAt: null },
    });
  });

  it('returns 409 COUPON_CODE_TAKEN when the code already exists', async () => {
    prismaMock.coupon.findUnique.mockResolvedValue(couponRow as never);
    const res = await POST(makePost({ code: 'THESIS', discountPercent: 95 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('COUPON_CODE_TAKEN');
    expect(prismaMock.coupon.create).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED for an out-of-range discountPercent', async () => {
    const res = await POST(makePost({ code: 'THESIS', discountPercent: 101 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_FAILED');
  });

  it('returns 403 when CSRF fails', async () => {
    vi.mocked(verifyCsrf).mockReturnValue(
      NextResponse.json({ error: 'CSRF_FAILED' }, { status: 403 }),
    );
    const res = await POST(makePost({ code: 'THESIS', discountPercent: 95 }));
    expect(res.status).toBe(403);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });
});
