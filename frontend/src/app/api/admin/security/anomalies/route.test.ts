// Admin — Sécurité — GET /api/admin/security/anomalies. Route wraps
// lib/server/security/anomalies.ts::detectAnomalies — its own rule logic is
// unit-tested separately; this file only covers the HTTP contract.
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));
vi.mock('@/lib/server/security/anomalies', () => ({
  detectAnomalies: vi.fn(),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { detectAnomalies } from '@/lib/server/security/anomalies';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockEnforceRateLimit = vi.mocked(enforceAdminRateLimit);
const mockDetectAnomalies = vi.mocked(detectAnomalies);

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/admin/security/anomalies', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceRateLimit.mockResolvedValue(null);
  mockDetectAnomalies.mockResolvedValue([]);
});

describe('GET /api/admin/security/anomalies', () => {
  it('returns the detected anomaly list', async () => {
    mockDetectAnomalies.mockResolvedValueOnce([
      {
        kind: 'REPEATED_FAILED_LOGIN',
        detail: '5 tentatives échouées',
        count: 5,
        since: '2026-08-10T00:00:00.000Z',
        email: 'victim@test.local',
      },
    ]);

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.anomalies).toHaveLength(1);
    expect(body.anomalies[0].kind).toBe('REPEATED_FAILED_LOGIN');
  });

  it('returns an empty list when nothing is flagged', async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ anomalies: [] });
  });

  it('401/403s when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(mockDetectAnomalies).not.toHaveBeenCalled();
  });

  it('429s when the rate limit fires', async () => {
    mockEnforceRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(429);
    expect(mockDetectAnomalies).not.toHaveBeenCalled();
  });
});
