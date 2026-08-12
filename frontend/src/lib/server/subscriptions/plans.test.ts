import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

// `plans.ts` calls `createLogger()` once at module scope, so the spy has to
// be installed before the module is imported — same pattern as
// subscriptions/reconcile.test.ts.
const { loggerWarnSpy } = vi.hoisted(() => ({ loggerWarnSpy: vi.fn() }));
vi.mock('../logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: loggerWarnSpy, error: vi.fn() }),
}));

import { expectedPriceFcfa, planDurationDays } from './plans';

beforeEach(() => {
  loggerWarnSpy.mockClear();
});

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

  it('truncates and warns on a non-integer override — FCFA has no decimals and Order.amount is an Int column', () => {
    vi.stubEnv('CHARIOW_ESSENTIEL_PRICE_FCFA', '5900.5');
    expect(expectedPriceFcfa('ESSENTIEL')).toBe(5900);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not an integer'),
      expect.objectContaining({ raw: '5900.5', truncated: 5900 }),
    );
  });
});

describe('planDurationDays', () => {
  it('returns 30 for ESSENTIEL', () => {
    expect(planDurationDays('ESSENTIEL')).toBe(30);
  });
});
