// Tests for POST /api/reminders ("Rappels groupés").
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/server/queues/email-queue-singleton', () => ({
  getEmailQueue: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { getEmailQueue } from '@/lib/server/queues/email-queue-singleton';
import { POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetEmailQueue = vi.mocked(getEmailQueue);
const authedCtx = { user: { sub: 'enc-1', email: 'enc@example.com' } };

function studentThesis(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thesis-1',
    student: { id: 'stu-1', name: 'Fatou Sow', email: 'fatou@example.com', avatarUrl: null },
    ...overrides,
  };
}

function makePost(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/reminders', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const validBody = {
  thesisIds: ['thesis-1'],
  subject: 'Rappel',
  body: 'Bonjour {{prénom}}, merci de soumettre votre travail.',
  channels: { email: false, inApp: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
  prismaMock.user.findUnique.mockResolvedValue({
    profileType: 'ENCADRANT',
    name: 'Pr. Diallo',
    email: 'enc@example.com',
  } as never);
});

describe('POST /api/reminders', () => {
  it('missing csrf → 403', async () => {
    const res = await POST(makePost(validBody, { csrf: 'missing' }));
    expect(res.status).toBe(403);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it('unauthenticated → 401', async () => {
    const { NextResponse } = await import('next/server');
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(401);
  });

  it('ETUDIANT profile → 403 PROFILE_TYPE_FORBIDDEN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ETUDIANT' } as never);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('PROFILE_TYPE_FORBIDDEN');
  });

  it('empty thesisIds → 400 VALIDATION_FAILED', async () => {
    const res = await POST(makePost({ ...validBody, thesisIds: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('VALIDATION_FAILED');
  });

  it('no channel selected → 400 VALIDATION_FAILED', async () => {
    const res = await POST(makePost({ ...validBody, channels: { email: false, inApp: false } }));
    expect(res.status).toBe(400);
  });

  it('empty body → 400 VALIDATION_FAILED', async () => {
    const res = await POST(makePost({ ...validBody, body: '   ' }));
    expect(res.status).toBe(400);
  });

  it('no thesis owned by this encadrant matches → 400 NO_VALID_RECIPIENTS', async () => {
    prismaMock.thesis.findMany.mockResolvedValue([] as never);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('NO_VALID_RECIPIENTS');
  });

  it('scopes the thesis lookup to the caller as encadrant', async () => {
    prismaMock.thesis.findMany.mockResolvedValue([studentThesis()] as never);
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    await POST(makePost(validBody));
    const args = prismaMock.thesis.findMany.mock.calls[0]?.[0];
    expect(args?.where).toEqual({
      id: { in: ['thesis-1'] },
      encadrantId: 'enc-1',
      archivedAt: null,
    });
  });

  it('creates a real Message row personalized with the student first name', async () => {
    prismaMock.thesis.findMany.mockResolvedValue([studentThesis()] as never);
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    await POST(makePost(validBody));
    const args = prismaMock.message.create.mock.calls[0]?.[0];
    expect(args?.data).toEqual({
      thesisId: 'thesis-1',
      senderId: 'enc-1',
      body: 'Bonjour Fatou, merci de soumettre votre travail.',
    });
  });

  it('inApp channel creates a Notification with a message-scoped dedupeKey', async () => {
    prismaMock.thesis.findMany.mockResolvedValue([studentThesis()] as never);
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    await POST(makePost(validBody));
    const args = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(args?.data?.userId).toBe('stu-1');
    expect(args?.data?.type).toBe('REMINDER');
    expect(args?.data?.dedupeKey).toBe('reminder:msg-1');
  });

  it('inApp:false skips Notification creation entirely', async () => {
    prismaMock.thesis.findMany.mockResolvedValue([studentThesis()] as never);
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' } as never);
    await POST(makePost({ ...validBody, channels: { email: false, inApp: false } }));
  });

  it('email channel enqueues via the email queue singleton when configured', async () => {
    prismaMock.thesis.findMany.mockResolvedValue([studentThesis()] as never);
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' } as never);
    const enqueue = vi.fn().mockResolvedValue('job-1');
    mockGetEmailQueue.mockReturnValue({ enqueue } as never);
    await POST(makePost({ ...validBody, channels: { email: true, inApp: false } }));
    expect(enqueue).toHaveBeenCalledTimes(1);
    const arg = enqueue.mock.calls[0]?.[0];
    expect(arg.to).toBe('fatou@example.com');
    expect(arg.subject).toBe('Rappel');
  });

  it('email channel with no queue configured degrades gracefully (still 201)', async () => {
    prismaMock.thesis.findMany.mockResolvedValue([studentThesis()] as never);
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' } as never);
    mockGetEmailQueue.mockReturnValue(null);
    const res = await POST(makePost({ ...validBody, channels: { email: true, inApp: false } }));
    expect(res.status).toBe(201);
  });

  it('processes multiple recipients sequentially and returns sent count', async () => {
    prismaMock.thesis.findMany.mockResolvedValue([
      studentThesis({ id: 'thesis-1' }),
      studentThesis({
        id: 'thesis-2',
        student: { id: 'stu-2', name: 'Kofi Mensah', email: 'kofi@example.com', avatarUrl: null },
      }),
    ] as never);
    prismaMock.message.create.mockResolvedValue({ id: 'msg-x' } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(makePost({ ...validBody, thesisIds: ['thesis-1', 'thesis-2'] }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.sent).toBe(2);
    expect(json.recipients).toHaveLength(2);
    expect(prismaMock.message.create).toHaveBeenCalledTimes(2);
  });

  it('a notification failure does not fail the request (best-effort)', async () => {
    prismaMock.thesis.findMany.mockResolvedValue([studentThesis()] as never);
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' } as never);
    prismaMock.notification.create.mockRejectedValue(new Error('boom'));
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(201);
  });
});
