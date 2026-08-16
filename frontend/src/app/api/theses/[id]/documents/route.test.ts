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

  it('student viewer sees everything — no scheduledAt visibility filter', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    await GET(makeGet(), { params });
    const args = prismaMock.document.findMany.mock.calls[0]?.[0];
    expect(args?.where).toEqual({ thesisId: 'thesis-1' });
  });

  it('encadrant viewer excludes documents still scheduled for the future', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.document.findMany.mockResolvedValue([] as never);
    await GET(makeGet(), { params });
    const args = prismaMock.document.findMany.mock.calls[0]?.[0];
    expect(args?.where?.OR).toEqual([
      { scheduledAt: null },
      { scheduledAt: { lte: expect.any(Date) } },
    ]);
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

  it('thesis blocked → 403 THESIS_BLOCKED, no Prisma writes', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', stage: 'Bloqué' }) as never,
    );
    const res = await POST(makePost({ fileUrl: 'https://x.com/a.pdf' }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('THESIS_BLOCKED');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
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

  it('accepts optional fileName + sizeBytes', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', encadrantId: 'enc-1' }) as never,
    );
    prismaMock.document.create.mockResolvedValue({ id: 'doc-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(
      makePost({
        fileUrl: 'https://x.com/a.pdf',
        fileName: 'Memoire_v4.docx',
        sizeBytes: 204800,
      }),
      { params },
    );
    expect(res.status).toBe(201);
    const createArg = prismaMock.document.create.mock.calls[0]?.[0];
    expect(createArg?.data?.fileName).toBe('Memoire_v4.docx');
    expect(createArg?.data?.sizeBytes).toBe(204800);
  });

  it('scheduledAt in the past → 400 SCHEDULED_AT_IN_PAST', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', encadrantId: 'enc-1' }) as never,
    );
    const res = await POST(
      makePost({
        fileUrl: 'https://x.com/a.pdf',
        scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('SCHEDULED_AT_IN_PAST');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it('scheduledAt in the future → creates with scheduledAt, does not notify yet', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', encadrantId: 'enc-1' }) as never,
    );
    prismaMock.document.create.mockResolvedValue({ id: 'doc-1' } as never);
    const futureIso = new Date(Date.now() + 60 * 60_000).toISOString();
    const res = await POST(makePost({ fileUrl: 'https://x.com/a.pdf', scheduledAt: futureIso }), {
      params,
    });
    expect(res.status).toBe(201);
    const createArg = prismaMock.document.create.mock.calls[0]?.[0];
    expect(createArg?.data?.scheduledAt).toEqual(new Date(futureIso));
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('student sending replyToDocumentId → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'user-1', encadrantId: 'enc-1' }) as never,
    );
    const res = await POST(
      makePost({ fileUrl: 'https://x.com/a.pdf', replyToDocumentId: 'doc-orig' }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it('encadrant reply with missing replyToDocumentId → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    const res = await POST(makePost({ fileUrl: 'https://x.com/correction.pdf' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it('encadrant reply with scheduledAt → 400 VALIDATION_FAILED', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    const futureIso = new Date(Date.now() + 60 * 60_000).toISOString();
    const res = await POST(
      makePost({
        fileUrl: 'https://x.com/correction.pdf',
        replyToDocumentId: 'doc-orig',
        scheduledAt: futureIso,
      }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it('encadrant reply target not found in this thesis → 400 INVALID_REPLY_TARGET', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.document.findFirst.mockResolvedValue(null);
    const res = await POST(
      makePost({ fileUrl: 'https://x.com/correction.pdf', replyToDocumentId: 'doc-missing' }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_REPLY_TARGET');
    expect(prismaMock.document.create).not.toHaveBeenCalled();
    const findArgs = prismaMock.document.findFirst.mock.calls[0]?.[0];
    expect(findArgs?.where).toEqual({
      id: 'doc-missing',
      thesisId: 'thesis-1',
      replyToDocumentId: null,
    });
  });

  it('encadrant reply target is itself a reply → 400 INVALID_REPLY_TARGET', async () => {
    // The findFirst query filters `replyToDocumentId: null` on the target, so
    // a reply-to-a-reply naturally resolves to null here — same code path as
    // "not found", asserted separately to document the business rule.
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.document.findFirst.mockResolvedValue(null);
    const res = await POST(
      makePost({
        fileUrl: 'https://x.com/correction.pdf',
        replyToDocumentId: 'doc-already-a-reply',
      }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_REPLY_TARGET');
  });

  it('encadrant reply happy path → 201, persists replyToDocumentId, notifies the student', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc-orig',
      replyToDocumentId: null,
    } as never);
    prismaMock.document.create.mockResolvedValue({
      id: 'doc-correction',
      thesisId: 'thesis-1',
      replyToDocumentId: 'doc-orig',
    } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(
      makePost({
        fileUrl: 'https://x.com/correction.pdf',
        chapter: 'Chapitre 3',
        replyToDocumentId: 'doc-orig',
      }),
      { params },
    );
    expect(res.status).toBe(201);
    const createArg = prismaMock.document.create.mock.calls[0]?.[0];
    expect(createArg?.data?.replyToDocumentId).toBe('doc-orig');
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.userId).toBe('stu-1');
    expect(notifArg?.data?.type).toBe('DOCUMENT_RECEIVED');
    expect(notifArg?.data?.dedupeKey).toBe('document-received:doc-correction');
  });

  it('encadrant reply while thesis is Bloqué → still succeeds (guard is student-only)', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1', stage: 'Bloqué' }) as never,
    );
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc-orig',
      replyToDocumentId: null,
    } as never);
    prismaMock.document.create.mockResolvedValue({ id: 'doc-correction' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(
      makePost({ fileUrl: 'https://x.com/correction.pdf', replyToDocumentId: 'doc-orig' }),
      { params },
    );
    expect(res.status).toBe(201);
  });
});
