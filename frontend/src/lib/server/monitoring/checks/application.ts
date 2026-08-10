// Admin monitoring — Application service check.
//
// A REAL external HTTP round trip against the deployed app (via APP_URL),
// not an in-process check — an in-process check would trivially always
// report "up" (the process running the check IS the process being checked).
//
// /api/health = liveness (process running). /api/readyz = readiness (DB +
// Redis bundle, see frontend/src/app/api/readyz/route.ts, protected-adjacent
// but read-only here). A readyz 503 is a real "erreur serveur 5xx" signal on
// a real endpoint, so it also fails this check — the Neon/Upstash cards
// separately diagnose *why*.
import 'server-only';
import { fetchWithTimeout, errorMessage, sanitizeCheckError } from '../sanitize';
import type { CheckResult } from '../types';

interface ReadyzBody {
  ok: boolean;
  checks?: Record<string, { ok: boolean; error?: string }>;
}

export async function checkApplication(): Promise<CheckResult> {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return { ok: false, unverified: true, latencyMs: 0, error: 'APP_URL is not configured' };
  }

  const base = appUrl.replace(/\/+$/, '');
  const t0 = Date.now();

  try {
    const healthRes = await fetchWithTimeout(`${base}/api/health`);
    const latencyMs = Date.now() - t0;
    if (!healthRes.ok) {
      return { ok: false, latencyMs, error: `/api/health returned HTTP ${healthRes.status}` };
    }

    const readyzRes = await fetchWithTimeout(`${base}/api/readyz`);
    if (!readyzRes.ok) {
      let reason = `HTTP ${readyzRes.status}`;
      try {
        const body = (await readyzRes.json()) as ReadyzBody;
        const failing = Object.entries(body.checks ?? {}).find(([, c]) => !c.ok);
        if (failing) reason = `${failing[0]}: ${failing[1]?.error ?? 'unhealthy'}`;
      } catch {
        // readyz body wasn't JSON — keep the HTTP-status reason.
      }
      return { ok: false, latencyMs, error: `/api/readyz unhealthy — ${reason}` };
    }

    return { ok: true, latencyMs, detail: { health: healthRes.status, readyz: readyzRes.status } };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: sanitizeCheckError(errorMessage(err)),
    };
  }
}
