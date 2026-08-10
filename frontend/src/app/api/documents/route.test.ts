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
import { encodeCursor } from '@/lib/server/pagination/paginate';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(url = 'http://test/api/documents'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

// Prisma types `where.AND` as WhereInput | WhereInput[] — the route always
// passes an array, so tests narrow the mock call arg through this shape
// once instead of casting at every access site.
interface DocumentWhereProbe {
  AND?: Array<{
    thesis?: { encadrantId?: string; archivedAt?: null; studentId?: string };
    OR?: unknown;
  }>;
  OR?: unknown;
}
function whereOf(args: unknown): DocumentWhereProbe | undefined {
  return (args as { where?: DocumentWhereProbe } | undefined)?.where;
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
    // AND-wrapped (not a bare top-level filter) — see route.ts comment on
    // why this must not collide with the cursor pagination's own `OR`.
    expect(whereOf(args)?.AND?.[0]?.thesis?.encadrantId).toBe('user-1');
  });

  it('excludes documents from archived (retirés) theses', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    await GET(makeGet());
    const args = prismaMock.document.findMany.mock.calls[0]?.[0];
    expect(whereOf(args)?.AND?.[0]?.thesis?.archivedAt).toBeNull();
  });

  it('applies the studentId filter when provided', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/documents?studentId=stu-1'));
    const args = prismaMock.document.findMany.mock.calls[0]?.[0];
    expect(whereOf(args)?.AND?.[0]?.thesis?.studentId).toBe('stu-1');
  });

  it('excludes documents still scheduled for the future', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    await GET(makeGet());
    const args = prismaMock.document.findMany.mock.calls[0]?.[0];
    expect(whereOf(args)?.AND?.[1]?.OR).toEqual([
      { scheduledAt: null },
      { scheduledAt: { lte: expect.any(Date) } },
    ]);
  });

  it('keeps the scheduledAt visibility filter intact when a cursor is present (AND/OR do not collide)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    const cursor = encodeCursor({ createdAt: new Date('2026-01-01T00:00:00.000Z'), id: 'doc-1' });
    await GET(makeGet(`http://test/api/documents?cursor=${encodeURIComponent(cursor)}`));
    const args = prismaMock.document.findMany.mock.calls[0]?.[0];
    // The visibility filter (inside AND) must survive; the cursor's own
    // top-level OR must be a separate key, not overwrite it.
    expect(whereOf(args)?.AND?.[1]?.OR).toBeDefined();
    expect(whereOf(args)?.OR).toBeDefined();
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

  it('returns a real total count independent of the page-limited items array', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    prismaMock.document.count.mockResolvedValue(63);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.total).toBe(63);
    const countArgs = prismaMock.document.count.mock.calls[0]?.[0];
    expect(whereOf(countArgs)?.AND?.[0]?.thesis?.encadrantId).toBe('user-1');
  });
});
