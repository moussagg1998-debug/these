/**
 * Plan configuration — single source of truth for price/duration per plan.
 * Only ESSENTIEL ships in v1; adding Premium later is one more entry here
 * plus one more `CHARIOW_PRODUCT_ID_*` env var (spec's "hors périmètre").
 */
import { createLogger } from '../logger';

const logger = createLogger();

export const PLAN_CONFIG = {
  ESSENTIEL: { defaultPriceFcfa: 5900, durationDays: 30 },
} as const;

export type PlanId = keyof typeof PLAN_CONFIG;

/**
 * Reads `CHARIOW_ESSENTIEL_PRICE_FCFA`, falling back to the built-in
 * default. FCFA has no decimals (CLAUDE.md: payment amounts are integer in
 * smallest currency unit) and `Order.amount` is an `Int` column — a
 * misconfigured fractional override is truncated rather than propagated,
 * since a non-integer reaching that column throws deep inside checkout's
 * post-charge write, orphaning an already-live Chariow session.
 */
export function expectedPriceFcfa(plan: PlanId): number {
  const raw = process.env.CHARIOW_ESSENTIEL_PRICE_FCFA;
  const n = raw ? Number(raw) : NaN;
  if (!(Number.isFinite(n) && n > 0)) return PLAN_CONFIG[plan].defaultPriceFcfa;
  if (!Number.isInteger(n)) {
    logger.warn('[Chariow] CHARIOW_ESSENTIEL_PRICE_FCFA is not an integer — truncating', {
      raw,
      truncated: Math.trunc(n),
    });
    return Math.trunc(n);
  }
  return n;
}

export function planDurationDays(plan: PlanId): number {
  return PLAN_CONFIG[plan].durationDays;
}
