import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/cron/auth', () => ({ verifyCronSecret: vi.fn() }));

const runMonitoringChecksLeasedMock = vi.fn();
vi.mock('@/lib/server/monitoring/run-checks', () => ({
  runMonitoringChecksLeased: (...args: unknown[]) => runMonitoringChecksLeasedMock(...args),
}));

import { verifyCronSecret } from '@/lib/server/cron/auth';
import { POST } from './route';

const mockVerifyCronSecret = vi.mocked(verifyCronSecret);

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/monitoring-check', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyCronSecret.mockReturnValue(null);
  runMonitoringChecksLeasedMock.mockResolvedValue([
    { service: 'application', status: 'OPERATIONAL' },
  ]);
});

describe('POST /api/cron/monitoring-check', () => {
  it('401s when the cron secret is missing/invalid, never runs the sweep', async () => {
    mockVerifyCronSecret.mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(runMonitoringChecksLeasedMock).not.toHaveBeenCalled();
  });

  it('runs the leased check sweep and returns its summary', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.summaries).toEqual([{ service: 'application', status: 'OPERATIONAL' }]);
    expect(runMonitoringChecksLeasedMock).toHaveBeenCalledTimes(1);
  });

  it('response includes x-request-id header', async () => {
    const res = await POST(makeReq());
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
});
