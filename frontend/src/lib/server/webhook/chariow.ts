// Re-exports the WebhookProvider impl from the payments adapter — mirrors
// `webhook/bictorys.ts` exactly. Lazy-init env reads (vi.stubEnv-friendly).
import 'server-only';
import type { WebhookProvider } from './handler';
import { createChariowProvider, type ChariowWebhookPayload } from '../payments/chariow';
import { ChariowProviderUnconfiguredError } from '../payments/chariow-singleton';

export type { ChariowWebhookPayload };

let _provider: WebhookProvider<ChariowWebhookPayload> | null = null;

const DEFAULT_CHARIOW_API_URL = 'https://api.chariow.com/v1';

/** Lazy-init — env reads happen at first call so `vi.stubEnv` works in tests. */
export function getChariowWebhookProvider(): WebhookProvider<ChariowWebhookPayload> {
  if (_provider) return _provider;
  const env = {
    CHARIOW_API_URL: process.env.CHARIOW_API_URL || DEFAULT_CHARIOW_API_URL,
    CHARIOW_API_KEY: process.env.CHARIOW_API_KEY ?? '',
    CHARIOW_PRODUCT_ID_ESSENTIEL: process.env.CHARIOW_PRODUCT_ID_ESSENTIEL ?? '',
  };
  if (!env.CHARIOW_API_KEY || !env.CHARIOW_PRODUCT_ID_ESSENTIEL) {
    throw new ChariowProviderUnconfiguredError();
  }
  _provider = createChariowProvider(env).webhookProvider;
  return _provider;
}

/** Convenience binding for the route file. */
export const chariowWebhookProvider: WebhookProvider<ChariowWebhookPayload> = {
  name: 'chariow',
  verifySignature: (raw, headers) => getChariowWebhookProvider().verifySignature(raw, headers),
  parsePayload: (raw) => getChariowWebhookProvider().parsePayload(raw),
  extractIds: (payload) => getChariowWebhookProvider().extractIds(payload),
};

/** @internal test-only */
export function __resetChariowWebhookProvider(): void {
  _provider = null;
}
