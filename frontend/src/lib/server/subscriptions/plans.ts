/**
 * Plan configuration — single source of truth for price/duration per plan.
 * Only ESSENTIEL ships in v1; adding Premium later is one more entry here
 * plus one more `CHARIOW_PRODUCT_ID_*` env var (spec's "hors périmètre").
 */
export const PLAN_CONFIG = {
  ESSENTIEL: { defaultPriceFcfa: 5900, durationDays: 30 },
} as const;

export type PlanId = keyof typeof PLAN_CONFIG;

/** Reads `CHARIOW_ESSENTIEL_PRICE_FCFA`, falling back to the built-in default. */
export function expectedPriceFcfa(plan: PlanId): number {
  const raw = process.env.CHARIOW_ESSENTIEL_PRICE_FCFA;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : PLAN_CONFIG[plan].defaultPriceFcfa;
}

export function planDurationDays(plan: PlanId): number {
  return PLAN_CONFIG[plan].durationDays;
}
