import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkApplication } from './application';

beforeEach(() => {
  vi.stubEnv('APP_URL', 'https://app.example.test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('checkApplication', () => {
  it('reports unverified when APP_URL is not configured', async () => {
    vi.unstubAllEnvs();
    const result = await checkApplication();
    expect(result.unverified).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('ok=true when both /api/health and /api/readyz return 200', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, checks: {} }), { status: 200 }),
      );

    const result = await checkApplication();
    expect(result.ok).toBe(true);
    expect(result.unverified).toBeUndefined();
  });

  it('ok=false when /api/health itself is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch failed'));

    const result = await checkApplication();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('ok=false with the failing sub-check reason when /api/readyz reports 503', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: false, checks: { database: { ok: false, error: 'timeout' } } }),
          { status: 503 },
        ),
      );

    const result = await checkApplication();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('database');
  });
});
