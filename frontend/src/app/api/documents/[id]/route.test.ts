// Tests for GET /api/documents/[id].
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };
const params = Promise.resolve({ id: 'doc-1' });

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

function documentRow(overrides: Partial<{ thesisId: string; scheduledAt: Date | null }> = {}) {
  return {
    id: 'doc-1',
    thesisId: overrides.thesisId ?? 'thesis-1',
    chapter: 'Chapitre 1',
    fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/doc-1.pdf',
    fileName: 'doc-1.pdf',
    sizeBytes: 1024,
    uploadedAt: new Date().toISOString(),
    scheduledAt: overrides.scheduledAt ?? null,
    replyToDocumentId: null,
  };
}

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/documents/doc-1', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('GET /api/documents/[id]', () => {
  it('document not found → 404 DOCUMENT_NOT_FOUND', async () => {
    prismaMock.document.findUnique.mockResolvedValue(null);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('DOCUMENT_NOT_FOUND');
  });

  it('caller is not a member of the owning thesis → 404', async () => {
    prismaMock.document.findUnique.mockResolvedValue(documentRow() as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow() as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(404);
  });

  it('encadrant of the owning thesis → 200 with the document', async () => {
    prismaMock.document.findUnique.mockResolvedValue(documentRow() as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('doc-1');
  });

  it('student of the owning thesis → 200 with the document', async () => {
    prismaMock.document.findUnique.mockResolvedValue(documentRow() as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
  });

  it('scheduled deposit not yet released → 404 for the encadrant, 200 for the student', async () => {
    const futureScheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scheduledDoc = documentRow({ scheduledAt: futureScheduledAt }) as never;

    prismaMock.document.findUnique.mockResolvedValue(scheduledDoc);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const encadrantRes = await GET(makeGet(), { params });
    expect(encadrantRes.status).toBe(404);
    const encadrantBody = await encadrantRes.json();
    expect(encadrantBody.error).toBe('DOCUMENT_NOT_FOUND');

    prismaMock.document.findUnique.mockResolvedValue(scheduledDoc);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    const studentRes = await GET(makeGet(), { params });
    expect(studentRes.status).toBe(200);
    const studentBody = await studentRes.json();
    expect(studentBody.id).toBe('doc-1');
  });
});
