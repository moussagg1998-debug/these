import { describe, it, expect, vi } from 'vitest';

const redisHolder: { current: { ping: () => Promise<unknown> } | null } = { current: null };
vi.mock('@/lib/server/redis', () => ({
  get redis() {
    return redisHolder.current;
  },
}));

const { checkUpstash } = await import('./upstash');

describe('checkUpstash', () => {
  it('reports unverified when UPSTASH env vars are not configured (redis === null)', async () => {
    redisHolder.current = null;
    const result = await checkUpstash();
    expect(result.unverified).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('ok=true when ping succeeds', async () => {
    redisHolder.current = { ping: vi.fn().mockResolvedValue('PONG') };
    const result = await checkUpstash();
    expect(result.ok).toBe(true);
    expect(result.unverified).toBeUndefined();
  });

  it('ok=false when ping throws', async () => {
    redisHolder.current = { ping: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const result = await checkUpstash();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });
});
