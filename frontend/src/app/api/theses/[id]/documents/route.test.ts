// Tests for GET + POST /api/theses/[id]/documents.
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
  return new NextRequest('http://test/api/theses/thesis-1/documents', { method: 'GET' });
}

function makePost(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/theses/thesis-1/documents', {
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

describe('GET /api/theses/[id]/documents', () => {
  it('non-member → 404 THESIS_NOT_FOUND', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow() as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(404);
  });

  it('member → 200 with items', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });
});

describe('POST /api/theses/[id]/documents', () => {
  it('missing csrf → 403', async () => {
    const res = await POST(makePost({ fileUrl: 'https://x.com/a.pdf' }, { csrf: 'missing' }), {
      params,
    });
    expect(res.status).toBe(403);
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it('encadrant (not student) attempting upload → 403 STUDENT_ONLY', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await POST(makePost({ fileUrl: 'https://x.com/a.pdf' }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('STUDENT_ONLY');
  });

  it('invalid fileUrl → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    const res = await POST(makePost({ fileUrl: 'not-a-url' }), { params });
    expect(res.status).toBe(400);
  });

  it('happy path → 201, notifies the encadrant', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', encadrantId: 'enc-1' }) as never,
    );
    prismaMock.document.create.mockResolvedValue({
      id: 'doc-1',
      thesisId: 'thesis-1',
      chapter: 'Chapitre 3',
      fileUrl: 'https://x.com/a.pdf',
    } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(makePost({ fileUrl: 'https://x.com/a.pdf', chapter: 'Chapitre 3' }), {
      params,
    });
    expect(res.status).toBe(201);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.userId).toBe('enc-1');
  });
});
