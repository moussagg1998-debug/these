// ThèseFacile admin dashboard "Universités" aggregate — real name + real
// encadrant/student counts, no fabricated plan/country/status columns.
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

// prisma.user.groupBy's conditional/overloaded generic signature defeats
// vitest-mock-extended's automatic Mock inference — cast to the minimal
// shape this file needs rather than fighting Prisma's generics.
const mockGroupBy = prismaMock.user.groupBy as unknown as {
  mockResolvedValue: (value: unknown) => void;
};

const admin = seedAdmin({ id: 'admin-1', email: 'admin@test.local' });
const adminCtx = {
  user: { sub: admin.id, email: admin.email },
  admin: { id: admin.id, email: admin.email, role: 'ADMIN' as const },
};

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
});

describe('/api/admin/institutions', () => {
  it('GET returns institutions with real encadrant/student counts', async () => {
    prismaMock.institution.findMany.mockResolvedValue([
      { id: 'inst-1', name: 'UCAD — Dakar' },
      { id: 'inst-2', name: 'Université de Cocody' },
    ] as never);
    mockGroupBy.mockResolvedValue([
      { institutionId: 'inst-1', profileType: 'ENCADRANT', _count: { _all: 3 } },
      { institutionId: 'inst-1', profileType: 'ETUDIANT', _count: { _all: 12 } },
      { institutionId: 'inst-2', profileType: 'ENCADRANT', _count: { _all: 1 } },
    ] as never);

    const res = await GET(makeGet('http://test/api/admin/institutions'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([
      { id: 'inst-1', name: 'UCAD — Dakar', encadrants: 3, students: 12 },
      { id: 'inst-2', name: 'Université de Cocody', encadrants: 1, students: 0 },
    ]);
  });

  it('GET returns empty items, never fabricates data, when no institutions exist', async () => {
    prismaMock.institution.findMany.mockResolvedValue([] as never);
    mockGroupBy.mockResolvedValue([] as never);

    const res = await GET(makeGet('http://test/api/admin/institutions'));
    expect(await res.json()).toEqual({ items: [] });
  });

  it('GET response never includes country/plan/status fields (not backed by schema)', async () => {
    prismaMock.institution.findMany.mockResolvedValue([
      { id: 'inst-1', name: 'UCAD — Dakar' },
    ] as never);
    mockGroupBy.mockResolvedValue([] as never);

    const res = await GET(makeGet('http://test/api/admin/institutions'));
    const body = await res.json();
    expect(body.items[0]).not.toHaveProperty('country');
    expect(body.items[0]).not.toHaveProperty('plan');
    expect(body.items[0]).not.toHaveProperty('status');
  });

  it('GET returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet('http://test/api/admin/institutions'));
    expect(res.status).toBe(403);
    expect(prismaMock.institution.findMany).not.toHaveBeenCalled();
  });

  it('GET short-circuits when admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet('http://test/api/admin/institutions'));
    expect(res.status).toBe(429);
    expect(prismaMock.institution.findMany).not.toHaveBeenCalled();
  });
});

describe('source invariants', () => {
  it("route source contains runtime='nodejs' and withRequestContext", () => {
    const src = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
    expect(src).toContain('withRequestContext');
  });
});
