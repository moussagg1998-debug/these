// Tests for GET /api/messages (cross-thesis encadrant inbox aggregate).
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/messages', { method: 'GET' });
}

function thesisRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thesis-1',
    topic: 'Impact de la microfinance',
    progress: 62,
    student: { id: 'stu-1', name: 'Fatou Sow', email: 'fatou@example.com', avatarUrl: null },
    messages: [],
    deadlines: [],
    documents: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
  prismaMock.notification.findMany.mockResolvedValue([] as never);
});

describe('GET /api/messages', () => {
  it('returns 401 when requireAuth bails', async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('ETUDIANT profile → 403 PROFILE_TYPE_FORBIDDEN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ETUDIANT' } as never);
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('PROFILE_TYPE_FORBIDDEN');
  });

  it('scopes the query by encadrantId, ordered by createdAt desc, capped at 200', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([] as never);
    await GET(makeGet());
    const args = prismaMock.thesis.findMany.mock.calls[0]?.[0];
    expect(args?.where?.encadrantId).toBe('user-1');
    expect(args?.orderBy).toEqual([{ createdAt: 'desc' }]);
    expect(args?.take).toBe(200);
  });

  it('excludes archived (retirés) theses from the inbox', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([] as never);
    await GET(makeGet());
    const args = prismaMock.thesis.findMany.mock.calls[0]?.[0];
    expect(args?.where?.archivedAt).toBeNull();
  });

  it('excludes validated (completedAt) deadlines from the next-deadline slot', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([] as never);
    await GET(makeGet());
    const args = prismaMock.thesis.findMany.mock.calls[0]?.[0];
    const deadlines = args?.include?.deadlines as { where?: { completedAt?: unknown } } | undefined;
    expect(deadlines?.where?.completedAt).toBeNull();
  });

  it('maps thesis + lastMessage + nextDeadline + recentDocuments through', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([
      thesisRow({
        messages: [{ id: 'm-1', body: 'Bonjour', senderId: 'stu-1', createdAt: new Date() }],
        deadlines: [{ id: 'd-1', title: 'Chapitre 4', dueAt: new Date(), urgency: 'medium' }],
        documents: [{ id: 'doc-1', chapter: 'Chapitre 4', fileUrl: 'https://x/doc.pdf' }],
      }),
    ] as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    const item = body.items[0];
    expect(item.thesis.id).toBe('thesis-1');
    expect(item.thesis.student.name).toBe('Fatou Sow');
    expect(item.lastMessage.body).toBe('Bonjour');
    expect(item.nextDeadline.title).toBe('Chapitre 4');
    expect(item.recentDocuments).toHaveLength(1);
  });

  it('lastMessage/nextDeadline are null when the thesis has none', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([thesisRow()] as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.items[0].lastMessage).toBeNull();
    expect(body.items[0].nextDeadline).toBeNull();
  });

  it('groups unread MESSAGE_RECEIVED notifications by data.thesisId into unreadCount/unreadNotificationIds', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([
      thesisRow({ id: 'thesis-1' }),
      thesisRow({ id: 'thesis-2', student: { id: 'stu-2', name: 'Moussa', email: 'm@x.com' } }),
    ] as never);
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 'notif-1', data: { thesisId: 'thesis-1' } },
      { id: 'notif-2', data: { thesisId: 'thesis-1' } },
      { id: 'notif-3', data: { thesisId: 'thesis-2' } },
    ] as never);
    const res = await GET(makeGet());
    const body = await res.json();
    const t1 = body.items.find((i: { thesis: { id: string } }) => i.thesis.id === 'thesis-1');
    const t2 = body.items.find((i: { thesis: { id: string } }) => i.thesis.id === 'thesis-2');
    expect(t1.unreadCount).toBe(2);
    expect(t1.unreadNotificationIds).toEqual(['notif-1', 'notif-2']);
    expect(t2.unreadCount).toBe(1);
    expect(t2.unreadNotificationIds).toEqual(['notif-3']);
  });

  it('queries only unread MESSAGE_RECEIVED notifications for the current user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    prismaMock.thesis.findMany.mockResolvedValue([] as never);
    await GET(makeGet());
    const args = prismaMock.notification.findMany.mock.calls[0]?.[0];
    expect(args?.where).toEqual({ userId: 'user-1', type: 'MESSAGE_RECEIVED', readAt: null });
  });
});
