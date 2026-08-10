// Admin monitoring — Neon / PostgreSQL check.
//
// Two real checks, not one: `SELECT 1` proves raw connectivity (same probe
// as /api/readyz), and a real Prisma model query proves the app can
// actually execute application-level queries against the current schema —
// catches migration-state / permission issues a bare SELECT 1 would miss.
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { withTimeout, errorMessage, sanitizeCheckError } from '../sanitize';
import type { CheckResult } from '../types';

export async function checkNeon(): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    await withTimeout(prisma.$queryRawUnsafe('SELECT 1'));
    await withTimeout(prisma.user.count());
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: sanitizeCheckError(errorMessage(err)),
    };
  }
}
