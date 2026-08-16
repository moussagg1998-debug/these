// Tests for PATCH /api/deadlines/[id] (completed toggle).
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { PATCH } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };
const params = Promise.resolve({ id: 'deadline-1' });

function thesisRow(overrides: Partial<{ studentId: string; encadrantId: string }> = {}) {
  return {
    id: 'thesis-1',
    studentId: overrides.studentId ?? 'stu-1',
    encadrantId: overrides.encadrantId ?? 'enc-1',
  };
}

function makePatch(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/deadlines/deadline-1', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('PATCH /api/deadlines/[id]', () => {
  it('missing csrf → 403, no Prisma writes', async () => {
    const res = await PATCH(makePatch({ completed: true }, { csrf: 'missing' }), { params });
    expect(res.status).toBe(403);
    expect(prismaMock.deadline.update).not.toHaveBeenCalled();
  });

  it('unknown deadline → 404 DEADLINE_NOT_FOUND', async () => {
    prismaMock.deadline.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatch({ completed: true }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('DEADLINE_NOT_FOUND');
  });

  it('non-member of the thesis → 404 THESIS_NOT_FOUND', async () => {
    prismaMock.deadline.findUnique.mockResolvedValue({
      id: 'deadline-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow() as never);
    const res = await PATCH(makePatch({ completed: true }), { params });
    expect(res.status).toBe(404);
  });

  it('student (not encadrant) attempting to validate → 403 ENCADRANT_ONLY', async () => {
    prismaMock.deadline.findUnique.mockResolvedValue({
      id: 'deadline-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ studentId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ completed: true }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('ENCADRANT_ONLY');
  });

  it('invalid body → 400 VALIDATION_FAILED', async () => {
    prismaMock.deadline.findUnique.mockResolvedValue({
      id: 'deadline-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ completed: 'yes' }), { params });
    expect(res.status).toBe(400);
  });

  it('encadrant marks respected → 200, sets completedAt', async () => {
    prismaMock.deadline.findUnique.mockResolvedValue({
      id: 'deadline-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.deadline.update.mockResolvedValue({
      id: 'deadline-1',
      title: 'Chapitre 3',
      completedAt: new Date(),
    } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await PATCH(makePatch({ completed: true }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.deadline.update.mock.calls[0]?.[0];
    expect(updateArg?.where?.id).toBe('deadline-1');
    expect(updateArg?.data?.completedAt).toBeInstanceOf(Date);
  });

  it('encadrant marks respected → notifies the student', async () => {
    prismaMock.deadline.findUnique.mockResolvedValue({
      id: 'deadline-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ studentId: 'stu-1', encadrantId: 'user-1' }) as never,
    );
    prismaMock.deadline.update.mockResolvedValue({
      id: 'deadline-1',
      title: 'Chapitre 3',
      completedAt: new Date(),
    } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    await PATCH(makePatch({ completed: true }), { params });
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.userId).toBe('stu-1');
    expect(notifArg?.data?.type).toBe('DEADLINE_COMPLETED');
    expect(notifArg?.data?.dedupeKey).toBe('deadline-completed:deadline-1');
  });

  it('encadrant un-marks → 200, clears completedAt, no notification', async () => {
    prismaMock.deadline.findUnique.mockResolvedValue({
      id: 'deadline-1',
      thesisId: 'thesis-1',
    } as never);
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.deadline.update.mockResolvedValue({
      id: 'deadline-1',
      completedAt: null,
    } as never);
    const res = await PATCH(makePatch({ completed: false }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.deadline.update.mock.calls[0]?.[0];
    expect(updateArg?.data?.completedAt).toBeNull();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});
