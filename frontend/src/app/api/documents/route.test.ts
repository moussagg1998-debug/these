// Tests for GET /api/documents (cross-thesis documents aggregate).
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(url = 'http://test/api/documents'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('GET /api/documents', () => {
  it('returns 401 when requireAuth bails', async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('ETUDIANT profile → 403 PROFILE_TYPE_FORBIDDEN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ETUDIANT' } as never);
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('PROFILE_TYPE_FORBIDDEN');
  });

  it('scopes the query by encadrantId', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    await GET(makeGet());
    const args = prismaMock.document.findMany.mock.calls[0]?.[0];
    expect(args?.where?.thesis?.encadrantId).toBe('user-1');
  });

  it('applies the studentId filter when provided', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/documents?studentId=stu-1'));
    const args = prismaMock.document.findMany.mock.calls[0]?.[0];
    expect(args?.where?.thesis?.studentId).toBe('stu-1');
  });

  it('returns items + nextCursor derived from uploadedAt', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `doc-${i}`,
      uploadedAt: new Date(2026, 0, i + 1),
    }));
    prismaMock.document.findMany.mockResolvedValue(rows as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.items).toHaveLength(20);
    expect(body.nextCursor).not.toBeNull();
  });
});
