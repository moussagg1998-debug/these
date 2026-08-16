import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkResend } from './resend';

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test_key');
  prismaMock.emailJob.count.mockResolvedValue(0);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('checkResend', () => {
  it('reports unverified when RESEND_API_KEY is not configured', async () => {
    vi.unstubAllEnvs();
    const result = await checkResend();
    expect(result.unverified).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('ok=true when the domains ping succeeds and there is no abnormal failure rate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    prismaMock.emailJob.count.mockResolvedValueOnce(20).mockResolvedValueOnce(0);

    const result = await checkResend();
    expect(result.ok).toBe(true);
    expect(result.detail).toMatchObject({ sentLastHour: 20, failedLastHour: 0 });
  });

  it('ok=false when the API key is rejected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const result = await checkResend();
    expect(result.ok).toBe(false);
  });

  it('ok=false on a real, clearly-abnormal recent send failure rate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    prismaMock.emailJob.count.mockResolvedValueOnce(1).mockResolvedValueOnce(5); // 5 failed, 1 sent

    const result = await checkResend();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('5');
  });

  it('does not flag a single stray failure (avoids false positives)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    prismaMock.emailJob.count.mockResolvedValueOnce(10).mockResolvedValueOnce(1);

    const result = await checkResend();
    expect(result.ok).toBe(true);
  });
});
