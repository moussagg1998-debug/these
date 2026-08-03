// Tests for GET + PATCH /api/profile ("Choix du profil").
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET, PATCH } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/profile', { method: 'GET' });
}

function makePatch(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const csrf = opts.csrf ?? 'match';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/profile', {
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

describe('GET /api/profile', () => {
  it('returns 401 when requireAuth bails', async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('returns profileType: null before onboarding', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      profileType: null,
      institutionId: null,
      name: null,
      email: 'me@example.com',
    } as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body).toEqual({
      profileType: null,
      institutionId: null,
      name: null,
      email: 'me@example.com',
    });
  });
});

describe('PATCH /api/profile', () => {
  it('missing csrf → 403', async () => {
    const res = await PATCH(makePatch({ profileType: 'ENCADRANT' }, { csrf: 'missing' }));
    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('invalid profileType → 400 VALIDATION_FAILED', async () => {
    const res = await PATCH(makePatch({ profileType: 'TEACHER' }));
    expect(res.status).toBe(400);
  });

  it('already set → 409 PROFILE_ALREADY_SET', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    const res = await PATCH(makePatch({ profileType: 'ETUDIANT' }));
    expect(res.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('first choice → 200, sets profileType', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: null } as never);
    prismaMock.user.update.mockResolvedValue({ profileType: 'ETUDIANT' } as never);
    const res = await PATCH(makePatch({ profileType: 'ETUDIANT' }));
    expect(res.status).toBe(200);
    const updateArg = prismaMock.user.update.mock.calls[0]?.[0];
    expect(updateArg?.where?.id).toBe('user-1');
    expect(updateArg?.data?.profileType).toBe('ETUDIANT');
  });
});
