import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_redis: unknown, _name: string, _ttl: number, fn: () => Promise<void>) =>
    fn(),
  ),
}));

vi.mock('@/lib/server/redis', () => ({ redis: null }));

const expirePlansMock = vi.fn(async () => ({ expired: 0 }));
vi.mock('@/lib/server/subscriptions/expire', () => ({
  expirePlans: expirePlansMock,
}));

vi.mock('@/lib/server/prisma', () => ({ prisma: {} }));

function makeReq(secret = 'cron-secret'): NextRequest {
  return new NextRequest('http://localhost/api/cron/subscription-expiration', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'cron-secret');
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/cron/subscription-expiration', () => {
  it('returns 401 with a wrong bearer token', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeReq('wrong'));
    expect(res.status).toBe(401);
  });

  it('calls expirePlans and returns the processed count', async () => {
    expirePlansMock.mockResolvedValueOnce({ expired: 3 });
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).processed).toBe(3);
  });
});
