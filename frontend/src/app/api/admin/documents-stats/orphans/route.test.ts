// Admin — Gestion des documents — orphaned-file heuristic. A FileUpload row
// is "orphaned" when its Cloudinary public_id (`key`) doesn't appear as a
// substring of any Document.fileUrl / Message.attachmentUrl / User.avatarUrl.
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
  return new NextRequest('http://test/api/admin/documents-stats/orphans', { method: 'GET' });
}

function upload(key: string) {
  return {
    id: `fu-${key}`,
    key,
    filename: `${key}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    createdAt: new Date('2026-08-01T00:00:00Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
  prismaMock.document.findMany.mockResolvedValue([] as never);
  prismaMock.message.findMany.mockResolvedValue([] as never);
  prismaMock.user.findMany.mockResolvedValue([] as never);
});

describe('GET /api/admin/documents-stats/orphans', () => {
  it('returns an empty result immediately when there are no candidates', async () => {
    prismaMock.fileUpload.findMany.mockResolvedValueOnce([] as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body).toEqual({ scanned: 0, orphanCount: 0, orphans: [] });
    expect(prismaMock.document.findMany).not.toHaveBeenCalled();
  });

  it('flags a key referenced nowhere as orphaned, and clears keys matched in Document/Message/User', async () => {
    prismaMock.fileUpload.findMany.mockResolvedValueOnce([
      upload('user-1/aaa'),
      upload('user-1/bbb'),
      upload('user-1/ccc'),
    ] as never);
    prismaMock.document.findMany.mockResolvedValueOnce([
      { fileUrl: 'https://res.cloudinary.com/demo/image/upload/v1/user-1/aaa.jpg' },
    ] as never);
    prismaMock.message.findMany.mockResolvedValueOnce([
      { attachmentUrl: 'https://res.cloudinary.com/demo/image/upload/v1/user-1/bbb.jpg' },
    ] as never);
    prismaMock.user.findMany.mockResolvedValueOnce([] as never);

    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.scanned).toBe(3);
    expect(body.orphanCount).toBe(1);
    expect(body.orphans).toHaveLength(1);
    expect(body.orphans[0].key).toBe('user-1/ccc');
  });

  it('candidate query excludes rows younger than the 1h grace period', async () => {
    prismaMock.fileUpload.findMany.mockResolvedValueOnce([] as never);
    await GET(makeGet());
    const args = prismaMock.fileUpload.findMany.mock.calls[0]?.[0];
    const createdAt = args?.where?.createdAt as { lt?: Date } | undefined;
    expect(createdAt?.lt).toBeInstanceOf(Date);
    expect(createdAt?.lt?.getTime()).toBeLessThanOrEqual(Date.now() - 59 * 60 * 1000);
  });

  it('returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(prismaMock.fileUpload.findMany).not.toHaveBeenCalled();
  });

  it('returns 429 when the admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(429);
    expect(prismaMock.fileUpload.findMany).not.toHaveBeenCalled();
  });
});
