import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/cron/auth', () => ({ verifyCronSecret: vi.fn(() => null) }));
vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_r: unknown, _n: string, _t: number, fn: () => Promise<void>) => fn()),
}));
vi.mock('@/lib/server/redis', () => ({ redis: null }));

const findManyDeadline = vi.fn();
const findUniqueUser = vi.fn();
const findUniquePrefs = vi.fn();
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    deadline: { findMany: (...args: unknown[]) => findManyDeadline(...args) },
    user: { findUnique: (...args: unknown[]) => findUniqueUser(...args) },
    notificationPreferences: { findUnique: (...args: unknown[]) => findUniquePrefs(...args) },
  },
}));

const createNotificationMock = vi.fn();
vi.mock('@/lib/server/notifications', () => ({
  createNotification: (...args: unknown[]) => createNotificationMock(...args),
}));

const enqueueMock = vi.fn();
const getEmailQueueMock = vi.fn();
vi.mock('@/lib/server/queues/email-queue-singleton', () => ({
  getEmailQueue: (...args: unknown[]) => getEmailQueueMock(...args),
}));

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/deadline-reminder', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

function makeDeadline(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'dl-1',
    title: 'Chapitre 3',
    dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    thesis: {
      id: 'thesis-1',
      topic: 'Microfinance rurale',
      encadrantId: 'encadrant-1',
      student: { id: 'student-1', name: 'Amina Diallo', email: 'amina@example.com' },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  findManyDeadline.mockReset();
  findUniqueUser.mockReset();
  findUniquePrefs.mockReset();
  createNotificationMock.mockReset();
  enqueueMock.mockReset();
  getEmailQueueMock.mockReset();
  getEmailQueueMock.mockReturnValue(null); // email not configured by default
  findUniqueUser.mockResolvedValue({
    name: 'Pr. Koné',
    email: 'kone@ucad.sn',
    timezone: 'Africa/Dakar',
  });
  findUniquePrefs.mockResolvedValue({ prefs: {} }); // D-10: missing ⇒ enabled
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/cron/deadline-reminder', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    const { verifyCronSecret } = await import('@/lib/server/cron/auth');
    (verifyCronSecret as Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('queries deadlines within the [now, now+3d] window, excluding archived theses', async () => {
    findManyDeadline.mockResolvedValueOnce([]);
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(findManyDeadline).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dueAt: { gte: expect.any(Date), lte: expect.any(Date) },
          remindEnabled: true,
          thesis: { archivedAt: null },
        },
      }),
    );
    const { dueAt } = findManyDeadline.mock.calls[0]![0].where as {
      dueAt: { gte: Date; lte: Date };
    };
    const spanMs = dueAt.lte.getTime() - dueAt.gte.getTime();
    expect(spanMs).toBeCloseTo(3 * 24 * 60 * 60 * 1000, -2);
  });

  it('creates an in-app notification for a matching deadline (default opt-in)', async () => {
    findManyDeadline.mockResolvedValueOnce([makeDeadline()]);
    createNotificationMock.mockResolvedValueOnce({ id: 'notif-1' });
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'encadrant-1',
        type: 'DEADLINE_REMINDER',
        dedupeKey: 'deadline-reminder:dl-1',
      }),
    );
    expect(await res.json()).toEqual({ ok: true, processed: 1, notified: 1 });
  });

  it('skips the in-app notification when the encadrant opted out', async () => {
    findUniquePrefs.mockResolvedValueOnce({ prefs: { DEADLINE_REMINDER: { inApp: false } } });
    findManyDeadline.mockResolvedValueOnce([makeDeadline()]);
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(createNotificationMock).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ ok: true, processed: 1, notified: 0 });
  });

  it('does not count a deduped (null) notification as notified', async () => {
    findManyDeadline.mockResolvedValueOnce([makeDeadline()]);
    createNotificationMock.mockResolvedValueOnce(null); // already sent — P2002 dedupe
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(await res.json()).toEqual({ ok: true, processed: 1, notified: 0 });
  });

  it('enqueues an email when the email channel is enabled and the queue is configured', async () => {
    findUniquePrefs.mockResolvedValueOnce({ prefs: { DEADLINE_REMINDER: { email: true } } });
    getEmailQueueMock.mockReturnValue({ enqueue: enqueueMock });
    findManyDeadline.mockResolvedValueOnce([makeDeadline()]);
    createNotificationMock.mockResolvedValueOnce({ id: 'notif-1' });
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'kone@ucad.sn',
        subject: expect.stringContaining('Chapitre 3'),
      }),
    );
  });

  it('skips email when the queue is not configured, even if the channel is enabled', async () => {
    findUniquePrefs.mockResolvedValueOnce({ prefs: { DEADLINE_REMINDER: { email: true } } });
    getEmailQueueMock.mockReturnValue(null);
    findManyDeadline.mockResolvedValueOnce([makeDeadline()]);
    createNotificationMock.mockResolvedValueOnce({ id: 'notif-1' });
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('caches the encadrant user + prefs lookup across multiple deadlines for the same encadrant', async () => {
    findManyDeadline.mockResolvedValueOnce([
      makeDeadline({ id: 'dl-1' }),
      makeDeadline({ id: 'dl-2' }),
    ]);
    createNotificationMock.mockResolvedValue({ id: 'notif' });
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(findUniqueUser).toHaveBeenCalledTimes(1);
    expect(findUniquePrefs).toHaveBeenCalledTimes(1);
    expect(createNotificationMock).toHaveBeenCalledTimes(2);
  });
});
