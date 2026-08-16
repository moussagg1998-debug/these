// Admin — Monitoring des emails — aggregate KPI counts. Mirrors the
// admin/stats/route.test.ts pattern (sequential prisma.emailJob.count calls).
// delivered/bounced are real, webhook-confirmed counts (deliveryStatus set
// by POST /api/webhooks/resend) — not derived from `sent`.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { seedAdmin } from '@/test-utils/admin-fixtures';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockEnforceAdminRateLimit = vi.mocked(enforceAdminRateLimit);

const admin = seedAdmin({ id: 'admin-1', email: 'admin@test.local' });
const adminCtx = {
  user: { sub: admin.id, email: admin.email },
  admin: { id: admin.id, email: admin.email, role: 'ADMIN' as const },
};

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/admin/email-stats', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
});

describe('/api/admin/email-stats', () => {
  it('GET returns sent/delivered/bounced/failed/pending/verification/passwordReset counts + computed failureRatePct', async () => {
    prismaMock.emailJob.count
      .mockResolvedValueOnce(90) // sent
      .mockResolvedValueOnce(85) // delivered
      .mockResolvedValueOnce(2) // bounced
      .mockResolvedValueOnce(10) // failed (FAILED+DEAD)
      .mockResolvedValueOnce(4) // pending
      .mockResolvedValueOnce(60) // verification
      .mockResolvedValueOnce(30); // passwordReset

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      windowHours: 24,
      sent: 90,
      delivered: 85,
      bounced: 2,
      failed: 10,
      pending: 4,
      verification: 60,
      passwordReset: 30,
      failureRatePct: 10, // 10 / (90+10) * 100
    });
  });

  it('GET computes failureRatePct: 0 when no sent/failed activity in the window (no division by zero)', async () => {
    prismaMock.emailJob.count.mockResolvedValue(0);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.failureRatePct).toBe(0);
  });

  it('GET rounds failureRatePct to 1 decimal place', async () => {
    prismaMock.emailJob.count
      .mockResolvedValueOnce(2) // sent
      .mockResolvedValueOnce(0) // delivered
      .mockResolvedValueOnce(0) // bounced
      .mockResolvedValueOnce(1) // failed
      .mockResolvedValueOnce(0) // pending
      .mockResolvedValueOnce(0) // verification
      .mockResolvedValueOnce(0); // passwordReset

    const res = await GET(makeGet());
    const body = await res.json();
    // 1 / 3 * 100 = 33.333... -> rounded to 1 decimal
    expect(body.failureRatePct).toBe(33.3);
  });

  it('GET queries each metric with the correct EmailJob field grouping and time window', async () => {
    prismaMock.emailJob.count.mockResolvedValue(0);
    await GET(makeGet());

    expect(prismaMock.emailJob.count).toHaveBeenNthCalledWith(1, {
      where: { status: 'SENT', sentAt: { gte: expect.any(Date) } },
    });
    expect(prismaMock.emailJob.count).toHaveBeenNthCalledWith(2, {
      where: { deliveryStatus: 'DELIVERED', deliveryStatusAt: { gte: expect.any(Date) } },
    });
    expect(prismaMock.emailJob.count).toHaveBeenNthCalledWith(3, {
      where: { deliveryStatus: 'BOUNCED', deliveryStatusAt: { gte: expect.any(Date) } },
    });
    expect(prismaMock.emailJob.count).toHaveBeenNthCalledWith(4, {
      where: { status: { in: ['FAILED', 'DEAD'] }, scheduledAt: { gte: expect.any(Date) } },
    });
    expect(prismaMock.emailJob.count).toHaveBeenNthCalledWith(5, { where: { status: 'PENDING' } });
    expect(prismaMock.emailJob.count).toHaveBeenNthCalledWith(6, {
      where: { subject: 'Verify your email', createdAt: { gte: expect.any(Date) } },
    });
    expect(prismaMock.emailJob.count).toHaveBeenNthCalledWith(7, {
      where: { subject: 'Reset your password', createdAt: { gte: expect.any(Date) } },
    });
  });

  it('GET returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(prismaMock.emailJob.count).not.toHaveBeenCalled();
  });

  it('GET short-circuits when admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(429);
    expect(prismaMock.emailJob.count).not.toHaveBeenCalled();
  });
});

describe('source invariants', () => {
  it("route source contains runtime='nodejs' and withRequestContext", () => {
    const src = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
    expect(src).toContain('withRequestContext');
  });
});
