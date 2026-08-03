// Tests for PATCH /api/comments/[id] (resolve toggle).
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { PATCH } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };
const params = Promise.resolve({ id: 'comment-1' });

function thesisRow(overrides: Partial<{ studentId: string; encadrantId: string }> = {}) {
  return {
    id: 'thesis-1',
    studentId: overrides.studentId ?? 'stu-1',
    encadrantId: overrides.encadrantId ?? 'enc-1',
  };
}

function makePatch(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/comments/comment-1', {
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

describe('PATCH /api/comments/[id]', () => {
  it('missing csrf → 403, no Prisma writes', async () => {
    const res = await PATCH(makePatch({ resolved: true }, { csrf: 'missing' }), { params });
    expect(res.status).toBe(403);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
  });

  it('unknown comment → 404 COMMENT_NOT_FOUND', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatch({ resolved: true }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('COMMENT_NOT_FOUND');
  });

  it('non-member of the thesis → 404 THESIS_NOT_FOUND', async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow() as never);
    const res = await PATCH(makePatch({ resolved: true }), { params });
    expect(res.status).toBe(404);
  });

  it('student (not encadrant) attempting resolve → 403 ENCADRANT_ONLY', async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ resolved: true }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('ENCADRANT_ONLY');
  });

  it('invalid body → 400 VALIDATION_FAILED', async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ resolved: 'yes' }), { params });
    expect(res.status).toBe(400);
  });

  it('encadrant resolves → 200, updates resolved', async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.comment.update.mockResolvedValue({ id: 'comment-1', resolved: true } as never);
    const res = await PATCH(makePatch({ resolved: true }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.comment.update.mock.calls[0]?.[0];
    expect(updateArg?.where?.id).toBe('comment-1');
    expect(updateArg?.data?.resolved).toBe(true);
  });
});
