// Admin -> Centre d'alertes — PATCH .../resolve ("Marquer comme traitée").
// Manual resolution: an ADMIN closes the incident regardless of whether the
// underlying check has actually recovered yet (e.g. "filed a ticket with
// Bictorys, done what I can from here"). Sets the same
// resolvedAt/durationMs fields the automatic recovery path in run-checks.ts
// sets — from the UI's perspective a resolved incident looks identical
// either way, which is intentional (see the schema comment on
// MonitoringIncident.status). Works from OPEN ("nouvelle") or ACKNOWLEDGED
// ("en cours"). Idempotent: already RESOLVED is a no-op 200.
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
  | { kind: 'OK'; incident: { id: string; status: string; resolvedAt: string | null } };

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
        select: { id: true, status: true, service: true, detectedAt: true, resolvedAt: true },
      });
      if (!target) return { kind: 'NOT_FOUND' as const };
      if (target.status === 'RESOLVED') {
        return {
          kind: 'OK' as const,
          incident: {
            id: target.id,
            status: target.status,
            resolvedAt: target.resolvedAt ? target.resolvedAt.toISOString() : null,
          },
        };
      }

      const now = new Date();
      const durationMs = now.getTime() - target.detectedAt.getTime();
      const updated = await tx.monitoringIncident.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: now, durationMs },
        select: { id: true, status: true, resolvedAt: true },
      });

      const userAgent = req.headers.get('user-agent');
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'monitoring.incident_resolve',
        targetType: 'MonitoringIncident',
        targetId: id,
        metadata: { service: target.service, durationMs },
        ip: clientIp(req),
        ...(userAgent ? { userAgent } : {}),
      });

      return {
        kind: 'OK' as const,
        incident: {
          id: updated.id,
          status: updated.status,
          resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
        },
      };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'INCIDENT_NOT_FOUND', message: 'Incident not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ incident: result.incident }, { status: 200 });
  });
}
