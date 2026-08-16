import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const pingMock = vi.fn();
const configMock = vi.fn();
vi.mock('cloudinary', () => ({
  v2: {
    config: configMock,
    api: { ping: (...args: unknown[]) => pingMock(...args) },
  },
}));

const { checkCloudinary } = await import('./cloudinary');

beforeEach(() => {
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'demo');
  vi.stubEnv('CLOUDINARY_API_KEY', 'key');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'secret');
  pingMock.mockReset();
  configMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('checkCloudinary', () => {
  it('reports unverified when credentials are not configured', async () => {
    vi.unstubAllEnvs();
    const result = await checkCloudinary();
    expect(result.unverified).toBe(true);
    expect(result.ok).toBe(false);
    expect(pingMock).not.toHaveBeenCalled();
  });

  it('ok=true when the Admin API ping succeeds', async () => {
    pingMock.mockResolvedValue({ status: 'ok' });
    const result = await checkCloudinary();
    expect(result.ok).toBe(true);
    expect(configMock).toHaveBeenCalled();
  });

  it('ok=false when the ping call throws (e.g. invalid credentials)', async () => {
    pingMock.mockRejectedValue(new Error('Invalid API key'));
    const result = await checkCloudinary();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid API key');
  });
});
