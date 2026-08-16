// Admin -> Centre d'alertes — PATCH .../acknowledge ("Prendre en charge").
// Moves an incident OPEN -> ACKNOWLEDGED ("nouvelle" -> "en cours"). Any
// ADMIN can acknowledge (same tier as users:status:suspend — this is an
// operational triage action, not a privileged one). Idempotent: already
// ACKNOWLEDGED is a no-op 200 (no AdminAction write, matching the
// same-status idempotency convention in users/[id]/status/route.ts);
// RESOLVED can't be "un-resolved" via this route.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { clientIp } from '@/lib/server/middleware/rate-limit-by-email';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_RESOLVED' }
  | { kind: 'OK'; incident: { id: string; status: string } };

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const { id } = await ctx.params;

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const target = await tx.monitoringIncident.findUnique({
        where: { id },
        select: { id: true, status: true, service: true },
      });
      if (!target) return { kind: 'NOT_FOUND' as const };
      if (target.status === 'RESOLVED') return { kind: 'ALREADY_RESOLVED' as const };
      if (target.status === 'ACKNOWLEDGED') {
        return { kind: 'OK' as const, incident: { id: target.id, status: target.status } };
      }

      const updated = await tx.monitoringIncident.update({
        where: { id },
        data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
        select: { id: true, status: true },
      });

      const userAgent = req.headers.get('user-agent');
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'monitoring.incident_acknowledge',
        targetType: 'MonitoringIncident',
        targetId: id,
        metadata: { service: target.service },
        ip: clientIp(req),
        ...(userAgent ? { userAgent } : {}),
      });

      return { kind: 'OK' as const, incident: updated };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'INCIDENT_NOT_FOUND', message: 'Incident not found' },
        { status: 404 },
      );
    }
    if (result.kind === 'ALREADY_RESOLVED') {
      return NextResponse.json(
        {
          error: 'ALREADY_RESOLVED',
          message: 'This incident is already resolved and cannot be acknowledged.',
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ incident: result.incident }, { status: 200 });
  });
}
