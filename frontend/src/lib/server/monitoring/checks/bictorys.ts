// Admin monitoring — Bictorys check.
//
// Deliberately does NOT call the real charge/payout endpoints (frontend/src/
// lib/server/payments/bictorys.ts, protected) — that would create real
// resources / spend WAF-retry budget just to run a health check. Instead:
//   1. A base-URL reachability probe — any HTTP response (even 401/404)
//      proves the service is up; only a network failure / timeout means
//      it's down.
//   2. Real recent Order outcomes (PAID vs FAILED, last hour) and the most
//      recent Bictorys WebhookLog row — genuine operational data already
//      persisted by the existing checkout + webhook flow, not a synthetic
//      transaction.
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { fetchWithTimeout, errorMessage, sanitizeCheckError } from '../sanitize';
import type { CheckResult } from '../types';

const LOOKBACK_MS = 60 * 60 * 1000; // 1 hour
const MIN_FAILURES_TO_FLAG = 3;

export async function checkBictorys(): Promise<CheckResult> {
  const apiKey = process.env.BICTORYS_API_KEY;
  const apiUrl = process.env.BICTORYS_API_URL;
  if (!apiKey || !apiUrl) {
    return {
      ok: false,
      unverified: true,
      latencyMs: 0,
      error: 'BICTORYS_API_KEY / BICTORYS_API_URL not configured',
    };
  }

  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout(apiUrl, { method: 'GET' });
    const latencyMs = Date.now() - t0;

    // Sequential — connection_limit=1 (see resend.ts / theses/route.ts for
    // the same rationale).
    const since = new Date(Date.now() - LOOKBACK_MS);
    const paidLastHour = await prisma.order.count({
      where: { provider: 'bictorys', status: 'PAID', updatedAt: { gte: since } },
    });
    const failedLastHour = await prisma.order.count({
      where: { provider: 'bictorys', status: 'FAILED', updatedAt: { gte: since } },
    });
    const lastWebhook = await prisma.webhookLog.findFirst({
      where: { provider: 'bictorys' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const detail = {
      httpStatus: res.status,
      paidLastHour,
      failedLastHour,
      lastWebhookAt: lastWebhook?.createdAt ?? null,
    };

    if (failedLastHour >= MIN_FAILURES_TO_FLAG && failedLastHour > paidLastHour) {
      return {
        ok: false,
        latencyMs,
        error: `${failedLastHour} Bictorys payment failures in the last hour (${paidLastHour} paid)`,
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
