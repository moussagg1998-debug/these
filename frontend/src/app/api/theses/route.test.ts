// Tests for GET + POST /api/theses.
// Bootstrap mirrors notifications/route.test.ts.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET, POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);

const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function makePost(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/theses', {
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

describe('GET /api/theses', () => {
  it('returns 401 when requireAuth bails', async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await GET(makeGet('http://test/api/theses'));
    expect(res.status).toBe(401);
  });

  it('returns 403 PROFILE_NOT_SET when profileType is null', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: null } as never);
    const res = await GET(makeGet('http://test/api/theses'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('PROFILE_NOT_SET');
  });

  it('ENCADRANT scopes the query by encadrantId', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/theses'));
    const args = prismaMock.thesis.findMany.mock.calls[0]?.[0];
    expect(args?.where?.encadrantId).toBe('user-1');
  });

  it('ETUDIANT scopes the query by studentId', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ETUDIANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/theses'));
    const args = prismaMock.thesis.findMany.mock.calls[0]?.[0];
    expect(args?.where?.studentId).toBe('user-1');
  });

  it('includes last document, next deadline, and comment count for the students table', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/theses'));
    const args = prismaMock.thesis.findMany.mock.calls[0]?.[0];
    expect(args?.include?.documents).toBeTruthy();
    expect(args?.include?.deadlines).toBeTruthy();
    const count = args?.include?._count as { select?: { comments?: boolean } } | undefined;
    expect(count?.select?.comments).toBe(true);
  });

  it('returns a real total count independent of the page-limited items array', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([{ id: 't1' }] as never);
    prismaMock.thesis.count.mockResolvedValue(47);
    const res = await GET(makeGet('http://test/api/theses'));
    const body = await res.json();
    expect(body.total).toBe(47);
    expect(body.items).toHaveLength(1);
    const countArgs = prismaMock.thesis.count.mock.calls[0]?.[0];
    expect(countArgs?.where?.encadrantId).toBe('user-1');
  });
});

describe('POST /api/theses', () => {
  it('missing csrf → 403, no Prisma writes', async () => {
    const res = await POST(makePost({ studentEmail: 'a@b.com', topic: 'x' }, { csrf: 'missing' }));
    expect(res.status).toBe(403);
    expect(prismaMock.thesis.create).not.toHaveBeenCalled();
  });

  it('ETUDIANT profile cannot create a thesis → 403 PROFILE_TYPE_FORBIDDEN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ETUDIANT' } as never);
    const res = await POST(makePost({ studentEmail: 'a@b.com', topic: 'x' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('PROFILE_TYPE_FORBIDDEN');
  });

  it('invalid body → 400 VALIDATION_FAILED', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    const res = await POST(makePost({ studentEmail: 'not-an-email', topic: '' }));
    expect(res.status).toBe(400);
  });

  it('unknown student email → 404 STUDENT_NOT_FOUND', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ profileType: 'ENCADRANT' } as never) // requireProfileType
      .mockResolvedValueOnce(null as never); // student lookup
    const res = await POST(makePost({ studentEmail: 'ghost@example.com', topic: 'x' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('STUDENT_NOT_FOUND');
  });

  it('student account is actually an encadrant → 422 NOT_A_STUDENT', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ profileType: 'ENCADRANT' } as never)
      .mockResolvedValueOnce({ id: 'stu-1', profileType: 'ENCADRANT' } as never);
    const res = await POST(makePost({ studentEmail: 'a@b.com', topic: 'x' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('NOT_A_STUDENT');
  });

  it('student already has a thesis → 409 THESIS_ALREADY_EXISTS', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ profileType: 'ENCADRANT' } as never)
      .mockResolvedValueOnce({ id: 'stu-1', profileType: 'ETUDIANT' } as never);
    prismaMock.thesis.findFirst.mockResolvedValue({ id: 'existing-thesis' } as never);
    const res = await POST(makePost({ studentEmail: 'a@b.com', topic: 'x' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('THESIS_ALREADY_EXISTS');
  });

  it('happy path → 201, creates thesis, notifies student', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ profileType: 'ENCADRANT' } as never)
      .mockResolvedValueOnce({ id: 'stu-1', profileType: null } as never);
    prismaMock.thesis.findFirst.mockResolvedValue(null);
    prismaMock.thesis.create.mockResolvedValue({
      id: 'thesis-1',
      topic: 'Impact de X',
      stage: 'En attente',
      progress: 0,
      studentId: 'stu-1',
      encadrantId: 'user-1',
    } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(makePost({ studentEmail: 'a@b.com', topic: 'Impact de X' }));
    expect(res.status).toBe(201);
    const createArg = prismaMock.thesis.create.mock.calls[0]?.[0];
    expect(createArg?.data?.studentId).toBe('stu-1');
    expect(createArg?.data?.encadrantId).toBe('user-1');
    expect(prismaMock.notification.create).toHaveBeenCalled();
  });

  it('accepts optional stage + deadlineAt and nests a Deadline create', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ profileType: 'ENCADRANT' } as never)
      .mockResolvedValueOnce({ id: 'stu-1', profileType: null } as never);
    prismaMock.thesis.findFirst.mockResolvedValue(null);
    prismaMock.thesis.create.mockResolvedValue({
      id: 'thesis-1',
      topic: 'Impact de X',
      stage: 'Rédaction',
      progress: 0,
      studentId: 'stu-1',
      encadrantId: 'user-1',
    } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(
      makePost({
        studentEmail: 'a@b.com',
        topic: 'Impact de X',
        stage: 'Rédaction',
        deadlineAt: '2026-12-01T00:00:00.000Z',
      }),
    );
    expect(res.status).toBe(201);
    const createArg = prismaMock.thesis.create.mock.calls[0]?.[0];
    expect(createArg?.data?.stage).toBe('Rédaction');
    const deadlines = createArg?.data?.deadlines as { create?: { title?: string } } | undefined;
    expect(deadlines?.create?.title).toBe('Échéance initiale');
  });

  it('rejects an unknown stage value → 400 VALIDATION_FAILED', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    const res = await POST(
      makePost({ studentEmail: 'a@b.com', topic: 'x', stage: 'Not a real stage' }),
    );
    expect(res.status).toBe(400);
  });
});
