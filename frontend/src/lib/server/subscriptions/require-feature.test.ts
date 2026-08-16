import { describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { requireFeature } from './require-feature';

function fakePrisma(user: unknown) {
  return { user: { findUnique: vi.fn().mockResolvedValue(user) } } as never;
}

describe('requireFeature', () => {
  it('FREE user lacking the feature → 403 PLAN_UPGRADE_REQUIRED with the feature name', async () => {
    const result = await requireFeature(
      fakePrisma({ plan: 'FREE', planExpiresAt: null }),
      'user-1',
      'BULK_REMINDERS',
    );
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('PLAN_UPGRADE_REQUIRED');
    expect(body.feature).toBe('BULK_REMINDERS');
  });

  it('active ESSENTIEL user with the feature → resolves to the user row', async () => {
    const result = await requireFeature(
      fakePrisma({ plan: 'ESSENTIEL', planExpiresAt: null }),
      'user-1',
      'BULK_REMINDERS',
    );
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ plan: 'ESSENTIEL', planExpiresAt: null });
  });

  it('expired ESSENTIEL user → 403 PLAN_UPGRADE_REQUIRED (not yet swept by the cron)', async () => {
    const result = await requireFeature(
      fakePrisma({ plan: 'ESSENTIEL', planExpiresAt: new Date(Date.now() - 1000) }),
      'user-1',
      'BULK_REMINDERS',
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it('unknown user → 404 USER_NOT_FOUND', async () => {
    const result = await requireFeature(fakePrisma(null), 'ghost-user', 'BULK_REMINDERS');
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('USER_NOT_FOUND');
  });
});
