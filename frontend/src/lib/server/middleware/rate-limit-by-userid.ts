// D-ADMIN-05 — Per-userId admin rate limiter. 100 req/min per admin
// userId, regardless of source IP (admins often share office IPs).
//
// Pattern: mirrors `createEmailLimiter` (per-email) but keyed on a
// stable `User.id` instead of an email string. Backed by the same
// `RedisRateLimitStore` (Upstash) when available.
//
// Usage from a Route Handler:
//   const auth = await requireAdmin('ADMIN');
//   if (auth instanceof NextResponse) return auth;
//   const limited = await enforceAdminRateLimit(auth.admin.id);
//   if (limited) return limited;
//
// Threat T-03-01-03: rate-limits the back-office surface — without it,
// a compromised admin token could be used to scrape PII at unbounded rate.
//
// WR-03 — fail-closed semantics in production. When `redis === null`
// (UPSTASH env missing) we fail OPEN in dev/CI so local development still
// works, but fail CLOSED with 503 in production so a misconfigured deploy
// (typo'd UPSTASH_REDIS_REST_URL, plan downgrade) does not silently
// disable the back-office rate limit.
import 'server-only';
import { NextResponse } from 'next/server';
import { redis } from '@/lib/server/redis';
import { RedisRateLimitStore } from '@/lib/server/rate-limit-store';

const ADMIN_PREFIX = 'rl:admin:userid:';
const WINDOW_MS = 60_000;
const MAX_HITS = 100;

/**
 * Enforce the per-userId admin rate limit. Returns a 429 NextResponse when
 * the userId has exceeded MAX_HITS in WINDOW_MS, otherwise returns null and
 * the caller should proceed.
 *
 * Behavior when `redis === null` (no Upstash configured):
 *   - In production (NODE_ENV === 'production'): returns 503
 *     RATE_LIMIT_BACKEND_UNAVAILABLE so the route fails closed (WR-03).
 *   - In dev / test / CI: returns null (fail open) so local development
 *     without Upstash still works.
 */
export async function enforceAdminRateLimit(userId: string): Promise<NextResponse | null> {
  if (!redis) {
    if (process.env.NODE_ENV === 'production') {
      // WR-03 — fail closed. Silent disablement of the back-office rate
      // limit in production is exactly the inverse of the T-03-01-03
      // mitigation. Surface as 503 so the route operator notices.
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_BACKEND_UNAVAILABLE',
          message: 'Rate-limit backend unavailable.',
        },
        { status: 503 },
      );
    }
    return null;
  }
  // Use empty `prefix` since we encode the full keyspace into the key
  // ourselves — the existing store applies its own prefix on top, so we
  // pass '' and prepend rl:admin:userid: explicitly to keep the keyspace
  // contract documented at this call site.
  const store = new RedisRateLimitStore({ redis, prefix: '', windowMs: WINDOW_MS });
  const { totalHits, resetTime } = await store.increment(`${ADMIN_PREFIX}${userId}`);
  if (totalHits > MAX_HITS) {
    const retryAfter = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      {
        error: 'TOO_MANY_REQUESTS',
        message: 'Admin rate limit exceeded; retry shortly.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(MAX_HITS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetTime.getTime() / 1000)),
        },
      },
    );
  }
  return null;
}

const COUPON_PREVIEW_PREFIX = 'rl:coupon-preview:userid:';
const COUPON_PREVIEW_WINDOW_MS = 60_000;
const COUPON_PREVIEW_MAX_HITS = 30;

/**
 * Enforce a per-userId rate limit on GET /api/subscriptions/coupon-preview.
 * Without this, an authenticated user could probe the coupon-code
 * namespace (admin-chosen, likely short words, direct monetary value) at
 * unlimited rate with nothing logged. 30/min comfortably covers legitimate
 * typing/re-checking while capping enumeration.
 *
 * Unlike `enforceAdminRateLimit`, this fails OPEN even in production when
 * redis is absent — this is a user-facing checkout-adjacent endpoint, and
 * blocking a real customer over a rate-limit backend outage is worse than
 * a temporary unmetered window on a preview-only, read-only lookup. Same
 * default-open stance as `createEmailLimiter`'s user-facing auth routes.
 */
export async function enforceCouponPreviewRateLimit(userId: string): Promise<NextResponse | null> {
  if (!redis) return null;
  const store = new RedisRateLimitStore({ redis, prefix: '', windowMs: COUPON_PREVIEW_WINDOW_MS });
  const { totalHits, resetTime } = await store.increment(`${COUPON_PREVIEW_PREFIX}${userId}`);
  if (totalHits > COUPON_PREVIEW_MAX_HITS) {
    const retryAfter = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'TOO_MANY_REQUESTS', message: 'Too many coupon checks; retry shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(COUPON_PREVIEW_MAX_HITS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetTime.getTime() / 1000)),
        },
      },
    );
  }
  return null;
}
