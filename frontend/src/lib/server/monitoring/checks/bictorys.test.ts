import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkBictorys } from './bictorys';

beforeEach(() => {
  vi.stubEnv('BICTORYS_API_KEY', 'test-key');
  vi.stubEnv('BICTORYS_API_URL', 'https://api.bictorys.test');
  prismaMock.order.count.mockResolvedValue(0);
  prismaMock.webhookLog.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('checkBictorys', () => {
  it('reports unverified when BICTORYS_API_KEY/API_URL are not configured', async () => {
    vi.unstubAllEnvs();
    const result = await checkBictorys();
    expect(result.unverified).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('ok=true on any HTTP response — reachability, not a real charge attempt', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }));
    prismaMock.order.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);

    const result = await checkBictorys();
    expect(result.ok).toBe(true);
    expect(result.detail).toMatchObject({ httpStatus: 404, paidLastHour: 5, failedLastHour: 0 });
  });

  it('never calls the real charge/payout endpoints — only fetches the base URL', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }));
    await checkBictorys();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.bictorys.test',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.bictorys.test');
  });

  it('ok=false on a network failure (service actually unreachable)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ETIMEDOUT'));
    const result = await checkBictorys();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ETIMEDOUT');
  });

  it('ok=false on a real, clearly-abnormal recent payment failure rate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    prismaMock.order.count.mockResolvedValueOnce(0).mockResolvedValueOnce(4); // 0 paid, 4 failed

    const result = await checkBictorys();
    expect(result.ok).toBe(false);
  });
});
