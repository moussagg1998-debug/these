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
import { GET, PATCH } from './route';

const mockRequireAuth = vi.mocked(requireAuth);

const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };
const params = Promise.resolve({ id: 'thesis-1' });

function thesisRow(overrides: Partial<{ studentId: string; encadrantId: string }> = {}) {
  return {
    id: 'thesis-1',
    topic: 'Sujet',
    stage: 'En attente',
    progress: 0,
    studentId: overrides.studentId ?? 'stu-1',
    encadrantId: overrides.encadrantId ?? 'enc-1',
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

  it('encadrant updates stage + progress → 200', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ stage: 'Rédaction', progress: 40 }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({ stage: 'Rédaction', progress: 40 });
  });
});
