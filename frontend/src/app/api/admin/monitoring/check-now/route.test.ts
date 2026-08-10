import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireSuperadmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));

const runMonitoringChecksMock = vi.fn();
vi.mock('@/lib/server/monitoring/run-checks', () => ({
  runMonitoringChecks: (...args: unknown[]) => runMonitoringChecksMock(...args),
}));

import { requireSuperadmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { POST } from './route';

const mockRequireSuperadmin = vi.mocked(requireSuperadmin);
const mockEnforceAdminRateLimit = vi.mocked(enforceAdminRateLimit);

// prisma.monitoringIncident.groupBy's conditional/overloaded generic
// signature defeats vitest-mock-extended's automatic Mock inference —
// cast to the minimal shape this file needs (same workaround as
// admin/institutions/route.test.ts's prisma.user.groupBy).
const mockGroupBy = prismaMock.monitoringIncident.groupBy as unknown as {
  mockResolvedValue: (value: unknown) => void;
};

const superadminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'SUPERADMIN' as const },
};

function makePost(opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = {};
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/admin/monitoring/check-now', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireSuperadmin.mockResolvedValue(superadminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
  runMonitoringChecksMock.mockResolvedValue([{ service: 'neon', status: 'OPERATIONAL' }]);
  prismaMock.monitoringServiceStatus.findMany.mockResolvedValue([]);
  mockGroupBy.mockResolvedValue([]);
  prismaMock.adminAction.create.mockResolvedValue({} as never);
});

describe('POST /api/admin/monitoring/check-now', () => {
  it('missing csrf → 403, never runs the sweep', async () => {
    const res = await POST(makePost({ csrf: 'missing' }));
    expect(res.status).toBe(403);
    expect(runMonitoringChecksMock).not.toHaveBeenCalled();
  });

  it('403s a plain ADMIN (SUPERADMIN-only)', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await POST(makePost());
    expect(res.status).toBe(403);
    expect(runMonitoringChecksMock).not.toHaveBeenCalled();
  });

  it('short-circuits when the admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await POST(makePost());
    expect(res.status).toBe(429);
    expect(runMonitoringChecksMock).not.toHaveBeenCalled();
  });

  it('runs the sweep, audits the action, and returns a fresh status summary', async () => {
    const res = await POST(makePost());
    expect(res.status).toBe(200);
    expect(runMonitoringChecksMock).toHaveBeenCalledTimes(1);

    const auditArg = prismaMock.adminAction.create.mock.calls[0]?.[0];
    expect(auditArg?.data).toMatchObject({ actorId: 'admin-1', action: 'monitoring.check_now' });

    const body = await res.json();
    expect(body.services).toHaveLength(8);
  });
});
