// Admin monitoring — Resend check.
//
// Two real signals, neither fabricated:
//   1. `GET /domains` with the API key — verifies the API is reachable and
//      the key is accepted, without sending an email (no side effects).
//   2. Real send outcomes from the existing EmailJob queue (frontend's
//      durable email queue, drained by /api/cron/email-queue-drain) over
//      the last hour — an actual failure rate from actual send attempts,
//      not a synthetic transaction.
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { fetchWithTimeout, errorMessage, sanitizeCheckError } from '../sanitize';
import type { CheckResult } from '../types';

const LOOKBACK_MS = 60 * 60 * 1000; // 1 hour
// Only flip the card unhealthy on a CLEARLY abnormal recent failure rate —
// avoids a single stray FAILED row (e.g. one bad recipient address) from
// coloring the whole service red.
const MIN_FAILURES_TO_FLAG = 3;

export async function checkResend(): Promise<CheckResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, unverified: true, latencyMs: 0, error: 'RESEND_API_KEY not configured' };
  }

  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return { ok: false, latencyMs, error: `Resend API returned HTTP ${res.status}` };
    }

    // Sequential — DATABASE_URL pins connection_limit=1 for Neon serverless
    // (same rationale as every other multi-query admin route in this repo).
    const since = new Date(Date.now() - LOOKBACK_MS);
    const sentLastHour = await prisma.emailJob.count({
      where: { status: 'SENT', sentAt: { gte: since } },
    });
    const failedLastHour = await prisma.emailJob.count({
      where: { status: { in: ['FAILED', 'DEAD'] }, scheduledAt: { gte: since } },
    });

    const detail = { sentLastHour, failedLastHour };
    if (failedLastHour >= MIN_FAILURES_TO_FLAG && failedLastHour > sentLastHour) {
      return {
        ok: false,
        latencyMs,
        error: `${failedLastHour} email send failures in the last hour (${sentLastHour} sent)`,
        detail,
      };
    }

    return { ok: true, latencyMs, detail };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: sanitizeCheckError(errorMessage(err)),
    };
  }
}
