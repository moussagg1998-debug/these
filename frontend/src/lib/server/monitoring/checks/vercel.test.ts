import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkVercel } from './vercel';

beforeEach(() => {
  vi.stubEnv('VERCEL_TOKEN', 'vercel_test_token');
  vi.stubEnv('VERCEL_PROJECT_ID', 'prj_123');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('checkVercel', () => {
  it('reports unverified when VERCEL_TOKEN/VERCEL_PROJECT_ID are not configured', async () => {
    vi.unstubAllEnvs();
    const result = await checkVercel();
    expect(result.unverified).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('ok=true when the latest deployment is READY', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ deployments: [{ readyState: 'READY', url: 'x.vercel.app' }] }),
        {
          status: 200,
        },
      ),
    );
    const result = await checkVercel();
    expect(result.ok).toBe(true);
    expect(result.detail).toMatchObject({ readyState: 'READY' });
  });

  it('ok=false when the latest deployment errored', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ deployments: [{ readyState: 'ERROR' }] }), { status: 200 }),
    );
    const result = await checkVercel();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ERROR');
  });

  it('ok=false when the Vercel API returns a non-2xx status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Forbidden', { status: 403 }));
    const result = await checkVercel();
    expect(result.ok).toBe(false);
  });
});
