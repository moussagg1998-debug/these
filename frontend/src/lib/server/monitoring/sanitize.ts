// Admin monitoring center — error sanitization + timeout helpers shared by
// every checker in ./checks/*.ts.
//
// sanitizeCheckError is defense in depth ON TOP OF "checkers never
// interpolate a raw env value into a message" — it strips anything that
// LOOKS like a bearer token / API key / long opaque secret before an error
// string is persisted to MonitoringServiceStatus/MonitoringIncident or
// returned from an admin route. See CLAUDE.md's monitoring security section:
// never expose API keys, secrets, tokens, or env vars in the dashboard.
import 'server-only';

const MAX_ERROR_LENGTH = 300;

const SECRET_LIKE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /\b(api[_-]?key|token|secret|authorization)\s*[=:]\s*[^\s&"']+/gi,
  // Long opaque tokens (JWTs, hex keys, base64 secrets) — also redacts long
  // non-secret IDs, which is an acceptable trade-off for a health-check
  // error string (never the primary debugging surface).
  /\b[A-Za-z0-9_-]{32,}\b/g,
];

export function sanitizeCheckError(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_LIKE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[redacted]');
  }
  return sanitized.length > MAX_ERROR_LENGTH
    ? `${sanitized.slice(0, MAX_ERROR_LENGTH)}…`
    : sanitized;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const DEFAULT_CHECK_TIMEOUT_MS = 6_000;

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_CHECK_TIMEOUT_MS,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms: number = DEFAULT_CHECK_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
