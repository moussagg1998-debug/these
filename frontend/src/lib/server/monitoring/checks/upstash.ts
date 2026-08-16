// Admin monitoring — Upstash Redis check. Reuses the existing `redis`
// singleton (frontend/src/lib/server/redis.ts, protected — read-only import
// here) — `redis === null` means UPSTASH_REDIS_REST_URL/TOKEN aren't set.
import 'server-only';
import { redis } from '@/lib/server/redis';
import { withTimeout, errorMessage, sanitizeCheckError } from '../sanitize';
import type { CheckResult } from '../types';

export async function checkUpstash(): Promise<CheckResult> {
  if (!redis) {
    return {
      ok: false,
      unverified: true,
      latencyMs: 0,
      error: 'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not configured',
    };
  }

  const t0 = Date.now();
  try {
    await withTimeout(redis.ping());
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: sanitizeCheckError(errorMessage(err)),
    };
  }
}
