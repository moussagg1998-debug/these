// Tests for GET /api/comments (cross-thesis comments aggregate).
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

function makeGet(url = 'http://test/api/comments'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('GET /api/comments', () => {
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
  });

  it('scopes by encadrantId and only top-level comments', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.comment.findMany.mockResolvedValue([] as never);
    await GET(makeGet());
    const args = prismaMock.comment.findMany.mock.calls[0]?.[0];
    expect(args?.where?.thesis?.encadrantId).toBe('user-1');
    expect(args?.where?.parentId).toBeNull();
  });

  it('applies resolved + priority filters', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.comment.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/comments?resolved=true&priority=high'));
    const args = prismaMock.comment.findMany.mock.calls[0]?.[0];
    expect(args?.where?.resolved).toBe(true);
    expect(args?.where?.priority).toBe('high');
  });

  it('includes reply count for the reply badge', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.comment.findMany.mockResolvedValue([] as never);
    await GET(makeGet());
    const args = prismaMock.comment.findMany.mock.calls[0]?.[0];
    const count = args?.include?._count as { select?: { replies?: boolean } } | undefined;
    expect(count?.select?.replies).toBe(true);
  });
});
