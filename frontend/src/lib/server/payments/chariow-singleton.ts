// Lazy-initialized Chariow provider + module-level CircuitBreaker — mirrors
// `provider-singleton.ts`'s Bictorys pattern exactly (see that file's header
// comment for the full "why lazy" / "why a single shared breaker" rationale,
// which applies unchanged here).
import 'server-only';
import { createChariowProvider, type ChariowProviderHandle } from '@/lib/server/payments/chariow';
import { CircuitBreaker } from '@/lib/server/payments/circuit-breaker';

const DEFAULT_CHARIOW_API_URL = 'https://api.chariow.com/v1';

export class ChariowProviderUnconfiguredError extends Error {
  constructor() {
    super(
      'Chariow provider not configured (CHARIOW_API_KEY/_PRODUCT_ID_ESSENTIEL missing or empty)',
    );
    this.name = 'ChariowProviderUnconfiguredError';
  }
}

let _provider: ChariowProviderHandle | null = null;

/**
 * Lazy-init singleton accessor. `CHARIOW_API_URL` defaults to Chariow's
 * public API base when unset — only `CHARIOW_API_KEY` and
 * `CHARIOW_PRODUCT_ID_ESSENTIEL` make the provider "unconfigured".
 */
export function getChariowProvider(): ChariowProviderHandle {
  if (_provider) return _provider;

  const url = process.env.CHARIOW_API_URL || DEFAULT_CHARIOW_API_URL;
  const key = process.env.CHARIOW_API_KEY ?? '';
  const productIdEssentiel = process.env.CHARIOW_PRODUCT_ID_ESSENTIEL ?? '';

  if (!key || !productIdEssentiel) {
    throw new ChariowProviderUnconfiguredError();
  }

  _provider = createChariowProvider({
    CHARIOW_API_URL: url,
    CHARIOW_API_KEY: key,
    CHARIOW_PRODUCT_ID_ESSENTIEL: productIdEssentiel,
  });
  return _provider;
}

/** Single-instance only — same D-PAY-02-style thresholds as `bictorys.charge`. */
export const chariowBreaker = new CircuitBreaker({
  name: 'chariow.charge',
  failureThreshold: 5,
  windowMs: 30_000,
  cooldownMs: 60_000,
});

/** @internal test-only — clears the cached provider so env stubs re-trigger lazy init. */
export function __resetChariowProviderSingleton(): void {
  _provider = null;
}
