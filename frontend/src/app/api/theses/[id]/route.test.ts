// Tests for GET + PATCH /api/theses/[id].
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET, PATCH, DELETE } from './route';

const mockRequireAuth = vi.mocked(requireAuth);

const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };
const params = Promise.resolve({ id: 'thesis-1' });

function thesisRow(
  overrides: Partial<{
    studentId: string;
    encadrantId: string;
    progress: number;
    archivedAt: Date | null;
  }> = {},
) {
  return {
    id: 'thesis-1',
    topic: 'Sujet',
    stage: 'En attente',
    progress: overrides.progress ?? 0,
    studentId: overrides.studentId ?? 'stu-1',
    encadrantId: overrides.encadrantId ?? 'enc-1',
    archivedAt: overrides.archivedAt ?? null,
  };
}

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/theses/thesis-1', { method: 'GET' });
}

function makePatch(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/theses/thesis-1', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

function makeDelete(opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = {};
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/theses/thesis-1', { method: 'DELETE', headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('GET /api/theses/[id]', () => {
  it('returns 401 when requireAuth bails', async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(401);
  });

  it('non-member (neither student nor encadrant) → 404 THESIS_NOT_FOUND', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'enc-1' }) as never,
    );
    const res = await GET(makeGet(), { params }); // authedCtx.user.sub = 'user-1'
    expect(res.status).toBe(404);
  });

  it('student of the thesis can read it → 200', async () => {
    prismaMock.thesis.findUnique
      .mockResolvedValueOnce(thesisRow({ studentId: 'user-1' }) as never) // resolveThesisAccess
      .mockResolvedValueOnce(thesisRow({ studentId: 'user-1' }) as never); // detail fetch w/ include
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/theses/[id]', () => {
  it('missing csrf → 403, no Prisma writes', async () => {
    const res = await PATCH(makePatch({ progress: 50 }, { csrf: 'missing' }), { params });
    expect(res.status).toBe(403);
    expect(prismaMock.thesis.update).not.toHaveBeenCalled();
  });

  it('student (not encadrant) attempting update → 403 ENCADRANT_ONLY', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ progress: 50 }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('ENCADRANT_ONLY');
    expect(prismaMock.thesis.update).not.toHaveBeenCalled();
  });

  it('invalid stage value → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ stage: 'Not a real stage' }), { params });
    expect(res.status).toBe(400);
  });

  it.each([
    ['En attente', 0],
    ['Rédaction', 40],
    ['Révision', 75],
    ['Soutenance', 100],
  ] as const)(
    'stage → %s derives progress %i, ignoring current progress',
    async (stage, expected) => {
      prismaMock.thesis.findUnique.mockResolvedValue(
        thesisRow({ encadrantId: 'user-1', progress: 10 }) as never,
      );
      prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
      const res = await PATCH(makePatch({ stage }), { params });
      expect(res.status).toBe(200);
      const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
      expect(updateArg?.data).toEqual({ stage, progress: expected });
    },
  );

  it("stage → Bloqué preserves the thesis's existing progress value", async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', progress: 40 }) as never,
    );
    prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ stage: 'Bloqué' }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({ stage: 'Bloqué', progress: 40 });
  });

  it('a client-supplied progress field is ignored — only stage drives it', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', progress: 10 }) as never,
    );
    prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ stage: 'Rédaction', progress: 99 }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({ stage: 'Rédaction', progress: 40 });
  });

  it('stage absent (empty body) → no fields updated', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', progress: 40 }) as never,
    );
    prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({}), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({});
  });
});

describe('DELETE /api/theses/[id] (retirer un étudiant — soft-archive)', () => {
  it('missing csrf → 403, no Prisma writes', async () => {
    const res = await DELETE(makeDelete({ csrf: 'missing' }), { params });
    expect(res.status).toBe(403);
    expect(prismaMock.thesis.update).not.toHaveBeenCalled();
  });

  it('non-member → 404 THESIS_NOT_FOUND, no writes', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'enc-1' }) as never,
    );
    const res = await DELETE(makeDelete(), { params }); // authedCtx.user.sub = 'user-1'
    expect(res.status).toBe(404);
    expect(prismaMock.thesis.update).not.toHaveBeenCalled();
  });

  it('student (not encadrant) attempting to remove → 403 ENCADRANT_ONLY', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('ENCADRANT_ONLY');
    expect(prismaMock.thesis.update).not.toHaveBeenCalled();
  });

  it('encadrant removes an active student → 200 JSON body, sets archivedAt, no cascade delete', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', archivedAt: null }) as never,
    );
    const now = new Date();
    prismaMock.thesis.update.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', archivedAt: now }) as never,
    );
    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(200);
    expect(prismaMock.thesis.delete).not.toHaveBeenCalled();
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data.archivedAt).toBeInstanceOf(Date);
    // Must return a real JSON body — the shared api() wrapper always calls
    // response.json() on a response.ok result, a bare 204 breaks it.
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('already-archived thesis → idempotent, preserves the original archivedAt', async () => {
    const archivedAt = new Date('2026-01-01T00:00:00Z');
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', archivedAt }) as never,
    );
    prismaMock.thesis.update.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', archivedAt }) as never,
    );
    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data.archivedAt).toBe(archivedAt);
  });
});
