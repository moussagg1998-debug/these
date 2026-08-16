// Admin monitoring — Vercel check.
//
// This repo has no Vercel API token configured today — reports `unverified`
// until VERCEL_TOKEN + VERCEL_PROJECT_ID are set. Latest deployment
// `readyState` covers "état des déploiements", "échecs de build/déploiement".
// Overall site reachability is covered by the Application card (health/
// readyz, served by this same Vercel deployment) — not duplicated here to
// avoid two cards reporting the same synthetic "up" ping.
import 'server-only';
import { fetchWithTimeout, errorMessage, sanitizeCheckError } from '../sanitize';
import type { CheckResult } from '../types';

interface Deployment {
  readyState?: string; // READY | ERROR | BUILDING | QUEUED | CANCELED
  url?: string;
  createdAt?: number;
}

interface DeploymentsResponse {
  deployments?: Deployment[];
}

export async function checkVercel(): Promise<CheckResult> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    return {
      ok: false,
      unverified: true,
      latencyMs: 0,
      error: 'VERCEL_TOKEN / VERCEL_PROJECT_ID not configured',
    };
  }

  const teamId = process.env.VERCEL_TEAM_ID;
  const teamQuery = teamId ? `&teamId=${encodeURIComponent(teamId)}` : '';

  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout(
      `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=1${teamQuery}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return { ok: false, latencyMs, error: `Vercel API returned HTTP ${res.status}` };
    }

    const data = (await res.json()) as DeploymentsResponse;
    const dep = data.deployments?.[0];
    if (!dep) {
      return { ok: true, latencyMs, detail: { message: 'No deployments found' } };
    }

    const ok =
      dep.readyState === 'READY' || dep.readyState === 'BUILDING' || dep.readyState === 'QUEUED';

    const detail = {
      readyState: dep.readyState ?? null,
      url: dep.url ?? null,
      createdAt: dep.createdAt ?? null,
    };

    return {
      ok,
      latencyMs,
      ...(ok ? {} : { error: `Latest deployment state: ${dep.readyState ?? 'unknown'}` }),
      detail,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: sanitizeCheckError(errorMessage(err)),
    };
  }
}
