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
      emailVerifiedAt: null,
      avatarUrl: null,
      department: null,
      academicGrade: null,
      specialties: [],
      bio: null,
      institution: null,
      locale: 'fr',
      timezone: 'Africa/Dakar',
      dateFormat: 'long',
    } as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body).toEqual({
      profileType: null,
      institutionId: null,
      name: null,
      email: 'me@example.com',
      emailVerified: false,
      avatarUrl: null,
      department: null,
      academicGrade: null,
      specialties: [],
      bio: null,
      institution: null,
      locale: 'fr',
      timezone: 'Africa/Dakar',
      dateFormat: 'long',
    });
  });

  it('returns avatarUrl when set', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      profileType: 'ENCADRANT',
      institutionId: null,
      name: 'Amadou Diallo',
      email: 'amadou@ucad.sn',
      emailVerifiedAt: null,
      avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/user-1/abc.jpg',
      department: null,
      academicGrade: null,
      specialties: [],
      bio: null,
      institution: null,
    } as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.avatarUrl).toBe('https://res.cloudinary.com/demo/image/upload/v1/user-1/abc.jpg');
  });

  it('returns institution {id, name} when the user belongs to one', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      profileType: 'ENCADRANT',
      institutionId: 'inst-1',
      name: 'Amadou Diallo',
      email: 'amadou@ucad.sn',
      emailVerifiedAt: null,
      department: null,
      academicGrade: null,
      specialties: [],
      bio: null,
      institution: { id: 'inst-1', name: 'Université Cheikh Anta Diop' },
    } as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.institution).toEqual({ id: 'inst-1', name: 'Université Cheikh Anta Diop' });
  });

  it('returns emailVerified: true and the Phase 10 profile fields when set', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      profileType: 'ENCADRANT',
      institutionId: null,
      name: 'Amadou Diallo',
      email: 'amadou@ucad.sn',
      emailVerifiedAt: new Date('2026-01-01'),
      department: 'Sciences Économiques',
      academicGrade: 'Maître de Conférences',
      specialties: ['Microfinance', 'Développement rural'],
      bio: 'Chercheur en économie du développement.',
      institution: null,
    } as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.emailVerified).toBe(true);
    expect(body.department).toBe('Sciences Économiques');
    expect(body.academicGrade).toBe('Maître de Conférences');
    expect(body.specialties).toEqual(['Microfinance', 'Développement rural']);
    expect(body.bio).toBe('Chercheur en économie du développement.');
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

  it('empty body → 400 VALIDATION_FAILED', async () => {
    const res = await PATCH(makePatch({}));
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('updates Profil-tab fields without profileType and without checking the one-shot lock', async () => {
    prismaMock.user.update.mockResolvedValue({
      profileType: 'ENCADRANT',
      name: 'Amadou Diallo',
      department: 'Sciences Économiques',
      academicGrade: 'Maître de Conférences',
      specialties: ['Microfinance'],
      bio: 'Bio courte.',
    } as never);
    const res = await PATCH(
      makePatch({
        name: 'Amadou Diallo',
        department: 'Sciences Économiques',
        academicGrade: 'Maître de Conférences',
        specialties: ['Microfinance'],
        bio: 'Bio courte.',
      }),
    );
    expect(res.status).toBe(200);
    // profileType absent from the body ⇒ the one-shot lock check must not run.
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    const updateArg = prismaMock.user.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({
      name: 'Amadou Diallo',
      department: 'Sciences Économiques',
      academicGrade: 'Maître de Conférences',
      specialties: ['Microfinance'],
      bio: 'Bio courte.',
    });
  });

  it('updating Profil-tab fields still works after profileType is already set (no 409)', async () => {
    prismaMock.user.update.mockResolvedValue({ department: 'Nouveau département' } as never);
    const res = await PATCH(makePatch({ department: 'Nouveau département' }));
    expect(res.status).toBe(200);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('changing an already-set profileType still 409s even alongside other fields', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profileType: 'ENCADRANT' } as never);
    const res = await PATCH(makePatch({ profileType: 'ETUDIANT', department: 'X' }));
    expect(res.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('sets avatarUrl after an upload', async () => {
    prismaMock.user.update.mockResolvedValue({
      avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/user-1/abc.jpg',
    } as never);
    const res = await PATCH(
      makePatch({ avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/user-1/abc.jpg' }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    const updateArg = prismaMock.user.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({
      avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/user-1/abc.jpg',
    });
  });

  it('non-URL avatarUrl → 400 VALIDATION_FAILED', async () => {
    const res = await PATCH(makePatch({ avatarUrl: 'not-a-url' }));
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('a plan/planExpiresAt tampering attempt in the body is silently dropped, not applied', async () => {
    prismaMock.user.update.mockResolvedValue({ name: 'Amadou Diallo' } as never);
    const res = await PATCH(
      makePatch({
        name: 'Amadou Diallo',
        plan: 'ESSENTIEL',
        planExpiresAt: '2099-01-01T00:00:00.000Z',
      }),
    );
    expect(res.status).toBe(200);
    const updateArg = prismaMock.user.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({ name: 'Amadou Diallo' });
  });
});
