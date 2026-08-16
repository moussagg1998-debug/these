import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/cron/auth', () => ({ verifyCronSecret: vi.fn(() => null) }));
vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_r: unknown, _n: string, _t: number, fn: () => Promise<void>) => fn()),
}));
vi.mock('@/lib/server/redis', () => ({ redis: null }));

const findManyDocument = vi.fn();
const updateDocument = vi.fn();
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    document: {
      findMany: (...args: unknown[]) => findManyDocument(...args),
      update: (...args: unknown[]) => updateDocument(...args),
    },
  },
}));

const createNotificationMock = vi.fn();
vi.mock('@/lib/server/notifications', () => ({
  createNotification: (...args: unknown[]) => createNotificationMock(...args),
}));

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/scheduled-deposits', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

function makeDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'doc-1',
    chapter: 'Chapitre 3',
    thesis: { id: 'thesis-1', encadrantId: 'encadrant-1' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  findManyDocument.mockReset();
  updateDocument.mockReset();
  createNotificationMock.mockReset();
  updateDocument.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/cron/scheduled-deposits', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    const { verifyCronSecret } = await import('@/lib/server/cron/auth');
    (verifyCronSecret as Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('queries documents whose scheduledAt is due', async () => {
    findManyDocument.mockResolvedValueOnce([]);
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(findManyDocument).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scheduledAt: { lte: expect.any(Date) } } }),
    );
  });

  it('clears scheduledAt and notifies the encadrant for a due document', async () => {
    findManyDocument.mockResolvedValueOnce([makeDoc()]);
    createNotificationMock.mockResolvedValueOnce({ id: 'notif-1' });
    const { POST } = await import('./route');
    const res = await POST(makeReq());

    expect(updateDocument).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { scheduledAt: null },
    });
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'encadrant-1',
        type: 'DOCUMENT_SUBMITTED',
        dedupeKey: 'document-submitted:doc-1',
        data: { thesisId: 'thesis-1', documentId: 'doc-1' },
      }),
    );
    expect(await res.json()).toEqual({ ok: true, released: 1 });
  });

  it('still releases the document even if the notification call throws', async () => {
    findManyDocument.mockResolvedValueOnce([makeDoc()]);
    createNotificationMock.mockRejectedValueOnce(new Error('boom'));
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(updateDocument).toHaveBeenCalled();
    expect(await res.json()).toEqual({ ok: true, released: 1 });
  });

  it('processes multiple due documents sequentially', async () => {
    findManyDocument.mockResolvedValueOnce([
      makeDoc({ id: 'doc-1' }),
      makeDoc({ id: 'doc-2', thesis: { id: 'thesis-2', encadrantId: 'encadrant-2' } }),
    ]);
    createNotificationMock.mockResolvedValue({ id: 'notif' });
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(updateDocument).toHaveBeenCalledTimes(2);
    expect(createNotificationMock).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ ok: true, released: 2 });
  });

  it('returns released: 0 when nothing is due', async () => {
    findManyDocument.mockResolvedValueOnce([]);
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(await res.json()).toEqual({ ok: true, released: 0 });
    expect(updateDocument).not.toHaveBeenCalled();
    expect(createNotificationMock).not.toHaveBeenCalled();
  });
});
