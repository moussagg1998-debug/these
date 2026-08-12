import { describe, it, expect, afterEach, vi } from 'vitest';
import { expectedPriceFcfa, planDurationDays } from './plans';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('expectedPriceFcfa', () => {
  it('defaults to 5900 when CHARIOW_ESSENTIEL_PRICE_FCFA is unset', () => {
    vi.stubEnv('CHARIOW_ESSENTIEL_PRICE_FCFA', '');
    expect(expectedPriceFcfa('ESSENTIEL')).toBe(5900);
  });

  it('reads CHARIOW_ESSENTIEL_PRICE_FCFA when set to a valid positive number', () => {
    vi.stubEnv('CHARIOW_ESSENTIEL_PRICE_FCFA', '6500');
    expect(expectedPriceFcfa('ESSENTIEL')).toBe(6500);
  });

  it('falls back to the default on a non-numeric or non-positive override', () => {
    vi.stubEnv('CHARIOW_ESSENTIEL_PRICE_FCFA', 'not-a-number');
    expect(expectedPriceFcfa('ESSENTIEL')).toBe(5900);
    vi.stubEnv('CHARIOW_ESSENTIEL_PRICE_FCFA', '-100');
    expect(expectedPriceFcfa('ESSENTIEL')).toBe(5900);
  });
});

describe('planDurationDays', () => {
  it('returns 30 for ESSENTIEL', () => {
    expect(planDurationDays('ESSENTIEL')).toBe(30);
  });
});
