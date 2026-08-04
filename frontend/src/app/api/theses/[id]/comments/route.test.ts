// Tests for GET + POST /api/theses/[id]/comments.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET, POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };
const params = Promise.resolve({ id: 'thesis-1' });

function thesisRow(overrides: Partial<{ studentId: string; encadrantId: string }> = {}) {
  return {
    id: 'thesis-1',
    studentId: overrides.studentId ?? 'stu-1',
    encadrantId: overrides.encadrantId ?? 'enc-1',
  };
}

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/theses/thesis-1/comments', { method: 'GET' });
}

function makePost(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/theses/thesis-1/comments', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('GET /api/theses/[id]/comments', () => {
  it('non-member → 404', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow() as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(404);
  });

  it('member → 200 with items', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.comment.findMany.mockResolvedValue([] as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
  });

  it('includes author email and linked document chapter (student dashboard needs both)', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.comment.findMany.mockResolvedValue([] as never);
    await GET(makeGet(), { params });
    const args = prismaMock.comment.findMany.mock.calls[0]?.[0];
    const author = args?.include?.author as { select?: { email?: boolean } } | boolean | undefined;
    const document = args?.include?.document as
      | { select?: { chapter?: boolean } }
      | boolean
      | undefined;
    expect(typeof author === 'object' && author?.select?.email).toBe(true);
    expect(typeof document === 'object' && document?.select?.chapter).toBe(true);
  });
});

describe('POST /api/theses/[id]/comments', () => {
  it('missing csrf → 403', async () => {
    const res = await POST(makePost({ body: 'hello' }, { csrf: 'missing' }), { params });
    expect(res.status).toBe(403);
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it('empty body → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await POST(makePost({ body: '' }), { params });
    expect(res.status).toBe(400);
  });

  it('parentId from a different thesis → 404 PARENT_NOT_FOUND', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.comment.findUnique.mockResolvedValue({
      id: 'c-other',
      thesisId: 'other-thesis',
    } as never);
    const res = await POST(makePost({ body: 'reply', parentId: 'c-other' }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('PARENT_NOT_FOUND');
  });

  it('encadrant posts → notifies the student', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.comment.create.mockResolvedValue({ id: 'c-1', thesisId: 'thesis-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(makePost({ body: 'Bon travail' }), { params });
    expect(res.status).toBe(201);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.userId).toBe('stu-1');
  });

  it('student posts → notifies the encadrant', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', encadrantId: 'enc-1' }) as never,
    );
    prismaMock.comment.create.mockResolvedValue({ id: 'c-2', thesisId: 'thesis-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(makePost({ body: 'Merci pour le retour' }), { params });
    expect(res.status).toBe(201);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.userId).toBe('enc-1');
  });

  it('accepts optional priority', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.comment.create.mockResolvedValue({ id: 'c-3', thesisId: 'thesis-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(makePost({ body: 'Attention urgente', priority: 'high' }), { params });
    expect(res.status).toBe(201);
    const createArg = prismaMock.comment.create.mock.calls[0]?.[0];
    expect(createArg?.data?.priority).toBe('high');
  });

  it('rejects an unknown priority value → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await POST(makePost({ body: 'x', priority: 'urgent' }), { params });
    expect(res.status).toBe(400);
  });
});
