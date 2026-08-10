// ThèseFacile admin dashboard KPI grid — only the 3 metrics with real
// backing data (encadrants/étudiants/thèses). No MRR, no "universités
// actives", no "comptes inactifs" — none of those exist in the schema.
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

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
});

describe('/api/admin/stats', () => {
  it('GET returns real encadrant/étudiant/thèse counts', async () => {
    prismaMock.user.count.mockResolvedValueOnce(218).mockResolvedValueOnce(1847);
    prismaMock.thesis.count.mockResolvedValue(1203);

    const res = await GET(makeGet('http://test/api/admin/stats'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ encadrants: 218, etudiants: 1847, theses: 1203 });

    expect(prismaMock.user.count).toHaveBeenNthCalledWith(1, {
      where: { profileType: 'ENCADRANT' },
    });
    expect(prismaMock.user.count).toHaveBeenNthCalledWith(2, {
      where: { profileType: 'ETUDIANT' },
    });
    expect(prismaMock.thesis.count).toHaveBeenCalledWith({ where: { archivedAt: null } });
  });

  it('GET response never includes fabricated MRR/inactive/university metrics', async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.thesis.count.mockResolvedValue(0);

    const res = await GET(makeGet('http://test/api/admin/stats'));
    const body = await res.json();
    expect(body).not.toHaveProperty('mrr');
    expect(body).not.toHaveProperty('inactiveAccounts');
    expect(body).not.toHaveProperty('activeUniversities');
  });

  it('GET returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet('http://test/api/admin/stats'));
    expect(res.status).toBe(403);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it('GET short-circuits when admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet('http://test/api/admin/stats'));
    expect(res.status).toBe(429);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });
});

describe('source invariants', () => {
  it("route source contains runtime='nodejs' and withRequestContext", () => {
    const src = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
    expect(src).toContain('withRequestContext');
  });
});
