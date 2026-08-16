// Admin monitoring center — shared types. See CLAUDE.md's "Provider
// recommendations" table for the services this polls; the exact set below
// (8 services) matches the Admin → Monitoring spec.
import 'server-only';

export const SERVICE_KEYS = [
  'application',
  'neon',
  'vercel',
  'github',
  'cloudinary',
  'resend',
  'upstash',
  'bictorys',
] as const;

export type ServiceKey = (typeof SERVICE_KEYS)[number];

export type ServiceStatus = 'OPERATIONAL' | 'WARNING' | 'CRITICAL' | 'UNVERIFIED';

export interface CheckResult {
  ok: boolean;
  /**
   * true = "cannot verify automatically" — missing credentials for an
   * optional provider (e.g. GITHUB_TOKEN unset). Never counts as a failure
   * against the warning/critical threshold and never fabricates a status.
   */
  unverified?: boolean;
  latencyMs: number;
  /** Sanitized (see sanitize.ts) — safe to persist and to return from an admin route. */
  error?: string;
  /** Small, non-sensitive extra context (e.g. { deploymentState: 'READY' }). */
  detail?: Record<string, unknown>;
}

export interface Checker {
  service: ServiceKey;
  run: () => Promise<CheckResult>;
}
