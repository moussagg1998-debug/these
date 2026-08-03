// Tests for GET + POST /api/theses/[id]/deadlines.
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
  return new NextRequest('http://test/api/theses/thesis-1/deadlines', { method: 'GET' });
}

function makePost(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/theses/thesis-1/deadlines', {
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

describe('GET /api/theses/[id]/deadlines', () => {
  it('non-member → 404', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow() as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(404);
  });

  it('member → 200', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    prismaMock.deadline.findMany.mockResolvedValue([] as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/theses/[id]/deadlines', () => {
  it('missing csrf → 403', async () => {
    const res = await POST(
      makePost({ title: 'Dépôt final', dueAt: '2026-06-01' }, { csrf: 'missing' }),
      { params },
    );
    expect(res.status).toBe(403);
    expect(prismaMock.deadline.create).not.toHaveBeenCalled();
  });

  it('student (not encadrant) → 403 ENCADRANT_ONLY', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    const res = await POST(makePost({ title: 'x', dueAt: '2026-06-01' }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('ENCADRANT_ONLY');
  });

  it('invalid dueAt → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await POST(makePost({ title: 'x', dueAt: 'not-a-date' }), { params });
    expect(res.status).toBe(400);
  });

  it('happy path → 201, notifies the student', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.deadline.create.mockResolvedValue({
      id: 'd-1',
      thesisId: 'thesis-1',
      title: 'Dépôt final',
      dueAt: new Date('2026-06-01'),
      urgency: 'high',
    } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(
      makePost({ title: 'Dépôt final', dueAt: '2026-06-01', urgency: 'high' }),
      { params },
    );
    expect(res.status).toBe(201);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.userId).toBe('stu-1');
  });
});
