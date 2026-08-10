// Tests for GET + POST /api/theses/[id]/messages.
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

function thesisRow(
  overrides: Partial<{ studentId: string; encadrantId: string; stage: string }> = {},
) {
  return {
    id: 'thesis-1',
    studentId: overrides.studentId ?? 'stu-1',
    encadrantId: overrides.encadrantId ?? 'enc-1',
    stage: overrides.stage ?? 'Rédaction',
  };
}

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/theses/thesis-1/messages', { method: 'GET' });
}

function makePost(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/theses/thesis-1/messages', {
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

describe('GET /api/theses/[id]/messages', () => {
  it('non-member → 404', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow() as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(404);
  });

  it('member → 200', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.message.findMany.mockResolvedValue([] as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/theses/[id]/messages', () => {
  it('missing csrf → 403', async () => {
    const res = await POST(makePost({ body: 'salut' }, { csrf: 'missing' }), { params });
    expect(res.status).toBe(403);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it('empty body → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await POST(makePost({ body: '' }), { params });
    expect(res.status).toBe(400);
  });

  it('blocked thesis, student sender → 403 THESIS_BLOCKED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', stage: 'Bloqué' }) as never,
    );
    const res = await POST(makePost({ body: 'salut' }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('THESIS_BLOCKED');
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it('blocked thesis, encadrant sender → still allowed', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', stage: 'Bloqué' }) as never,
    );
    prismaMock.message.create.mockResolvedValue({ id: 'm-1', thesisId: 'thesis-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(makePost({ body: 'salut' }), { params });
    expect(res.status).toBe(201);
  });

  it('student sends → notifies the encadrant', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', encadrantId: 'enc-1' }) as never,
    );
    prismaMock.message.create.mockResolvedValue({ id: 'm-1', thesisId: 'thesis-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(makePost({ body: 'Bonjour Professeur' }), { params });
    expect(res.status).toBe(201);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.userId).toBe('enc-1');
  });

  it('attachment-only (no body) → 201, notification falls back to a fixed label', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', encadrantId: 'enc-1' }) as never,
    );
    prismaMock.message.create.mockResolvedValue({ id: 'm-1', thesisId: 'thesis-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(
      makePost({
        attachmentUrl: 'https://res.cloudinary.com/demo/image/upload/x.jpg',
        attachmentFilename: 'x.jpg',
        attachmentMimeType: 'image/jpeg',
      }),
      { params },
    );
    expect(res.status).toBe(201);
    const createArg = prismaMock.message.create.mock.calls[0]?.[0];
    expect(createArg?.data?.attachmentUrl).toBe(
      'https://res.cloudinary.com/demo/image/upload/x.jpg',
    );
    expect(createArg?.data?.body).toBe('');
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.body).toBe('📎 Pièce jointe');
  });

  it('invalid attachmentUrl (not a URL) → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await POST(makePost({ attachmentUrl: 'not-a-url' }), { params });
    expect(res.status).toBe(400);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });
});
