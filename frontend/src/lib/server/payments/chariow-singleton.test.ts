import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getChariowProvider,
  ChariowProviderUnconfiguredError,
  __resetChariowProviderSingleton,
} from './chariow-singleton';

beforeEach(() => {
  __resetChariowProviderSingleton();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getChariowProvider', () => {
  it('throws ChariowProviderUnconfiguredError when CHARIOW_API_KEY is missing', () => {
    vi.stubEnv('CHARIOW_API_KEY', '');
    vi.stubEnv('CHARIOW_PRODUCT_ID_ESSENTIEL', 'prod_1');
    expect(() => getChariowProvider()).toThrow(ChariowProviderUnconfiguredError);
  });

  it('throws ChariowProviderUnconfiguredError when CHARIOW_PRODUCT_ID_ESSENTIEL is missing', () => {
    vi.stubEnv('CHARIOW_API_KEY', 'key');
    vi.stubEnv('CHARIOW_PRODUCT_ID_ESSENTIEL', '');
    expect(() => getChariowProvider()).toThrow(ChariowProviderUnconfiguredError);
  });

  it('defaults CHARIOW_API_URL to https://api.chariow.com/v1 when unset', () => {
    vi.stubEnv('CHARIOW_API_URL', '');
    vi.stubEnv('CHARIOW_API_KEY', 'key');
    vi.stubEnv('CHARIOW_PRODUCT_ID_ESSENTIEL', 'prod_1');
    const provider = getChariowProvider();
    expect(provider.name).toBe('chariow');
  });

  it('caches the instance across calls', () => {
    vi.stubEnv('CHARIOW_API_KEY', 'key');
    vi.stubEnv('CHARIOW_PRODUCT_ID_ESSENTIEL', 'prod_1');
    expect(getChariowProvider()).toBe(getChariowProvider());
  });
});
