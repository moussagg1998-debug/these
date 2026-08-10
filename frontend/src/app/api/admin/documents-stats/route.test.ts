// Admin — Gestion des documents — aggregate KPI counts. Mirrors
// security/summary/route.test.ts's shape (sequential prisma calls,
// requireAdmin + rate limit gating).
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

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

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/admin/documents-stats', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
  prismaMock.document.count.mockResolvedValue(0);
  prismaMock.document.findMany.mockResolvedValue([] as never);
  prismaMock.fileUpload.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0 } } as never);
  prismaMock.uploadErrorEvent.count.mockResolvedValue(0);
});

describe('GET /api/admin/documents-stats', () => {
  it('returns windowHours + all KPI fields, shaping the recent-documents list', async () => {
    prismaMock.document.count.mockResolvedValueOnce(42);
    prismaMock.document.findMany.mockResolvedValueOnce([
      {
        id: 'doc-1',
        chapter: 'Chapitre 3',
        fileName: 'chapitre3.pdf',
        sizeBytes: 204800,
        uploadedAt: new Date('2026-08-01T00:00:00Z'),
        thesis: {
          topic: 'Impact du mobile money',
          student: { name: 'Fatou Sow', email: 'f@t.local' },
        },
      },
    ] as never);
    prismaMock.fileUpload.aggregate
      .mockResolvedValueOnce({ _sum: { sizeBytes: 1_000_000 } } as never)
      .mockResolvedValueOnce({ _avg: { sizeBytes: 51234.6 } } as never);
    prismaMock.uploadErrorEvent.count
      .mockResolvedValueOnce(5) // VALIDATION
      .mockResolvedValueOnce(2); // CLOUDINARY

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      windowHours: 24,
      documentCount: 42,
      recentDocuments: [
        {
          id: 'doc-1',
          chapter: 'Chapitre 3',
          fileName: 'chapitre3.pdf',
          sizeBytes: 204800,
          uploadedAt: '2026-08-01T00:00:00.000Z',
          thesisTopic: 'Impact du mobile money',
          studentName: 'Fatou Sow',
        },
      ],
      storageBytes: 1_000_000,
      avgFileSizeBytes: 51235,
      uploadErrors24h: 5,
      cloudinaryErrors24h: 2,
    });
  });

  it('falls back to student email when name is null, and to 0 when aggregates are null', async () => {
    prismaMock.document.findMany.mockResolvedValueOnce([
      {
        id: 'doc-2',
        chapter: null,
        fileName: null,
        sizeBytes: null,
        uploadedAt: new Date('2026-08-01T00:00:00Z'),
        thesis: { topic: 'X', student: { name: null, email: 'anon@t.local' } },
      },
    ] as never);
    prismaMock.fileUpload.aggregate
      .mockResolvedValueOnce({ _sum: { sizeBytes: null } } as never)
      .mockResolvedValueOnce({ _avg: { sizeBytes: null } } as never);

    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.recentDocuments[0].studentName).toBe('anon@t.local');
    expect(body.storageBytes).toBe(0);
    expect(body.avgFileSizeBytes).toBe(0);
  });

  it('returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(prismaMock.document.count).not.toHaveBeenCalled();
  });

  it('returns 429 when the admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(429);
    expect(prismaMock.document.count).not.toHaveBeenCalled();
  });
});
