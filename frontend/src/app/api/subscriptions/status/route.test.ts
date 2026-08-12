import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(async () => ({ user: { sub: 'user-1', email: 'me@example.com' } })),
}));

// NOTE: Vitest hoists every `vi.mock()` call above ALL other top-level
// statements in this file (including preceding `const` declarations), and
// only auto-hoists referenced variables whose name contains "mock"
// (case-insensitive) along with it. `userFindUnique` and `orderFindFirst`
// don't match that heuristic, so referencing them directly from a
// `vi.mock()` factory throws "Cannot access '...' before initialization"
// the moment `./route` is statically imported below. `vi.hoisted()` is
// Vitest's documented, name-independent fix. No test behavior/assertions
// differ from the task brief — only this declaration mechanism (same fix
// already applied in subscriptions/checkout/route.test.ts and
// subscriptions/verify/route.test.ts for the identical issue).
const { userFindUnique, orderFindFirst } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  orderFindFirst: vi.fn(),
}));
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    order: { findFirst: orderFindFirst },
  },
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

function makeReq(): NextRequest {
  return new NextRequest('http://test/api/subscriptions/status');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue({ user: { sub: 'user-1', email: 'me@example.com' } });
});

describe('GET /api/subscriptions/status', () => {
  it('returns plan, planExpiresAt, and the latest chariow order', async () => {
    userFindUnique.mockResolvedValueOnce({
      plan: 'ESSENTIEL',
      planExpiresAt: new Date('2026-09-10'),
    });
    orderFindFirst.mockResolvedValueOnce({
      id: 'o1',
      status: 'PAID',
      amount: 5900,
      currency: 'XOF',
      paidAt: new Date('2026-08-11'),
    });
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe('ESSENTIEL');
    expect(body.latestOrder.id).toBe('o1');
  });

  it('returns latestOrder: null when the user never attempted a Chariow checkout', async () => {
    userFindUnique.mockResolvedValueOnce({ plan: 'FREE', planExpiresAt: null });
    orderFindFirst.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.latestOrder).toBeNull();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });
});
