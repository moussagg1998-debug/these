// GET /api/admin/institutions — ThèseFacile admin dashboard "Universités"
// table (Option A scope, see .planning/banani/admin-dashboard.md). Real
// institution name + real encadrant/student counts. No `country`/`plan`/
// `status` — those fields don't exist on Institution today; the frontend
// simply doesn't render columns for them rather than fabricating values.
//
// take: 100, no cursor pagination — same "good enough for v1" precedent as
// GET /api/deadlines (Phase 5) and GET /api/messages (Phase 11): a
// cross-cutting admin aggregate, not a paginated end-user list.
//
// Two sequential queries, never Promise.all — DATABASE_URL pins
// connection_limit=1 for Neon serverless; running admin aggregate queries
// in parallel saturates the pool under load (same bug class fixed in
// Phase 14's pagination work).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const TAKE = 100;

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(_req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const institutions = await prisma.institution.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: TAKE,
    });

    const counts = await prisma.user.groupBy({
      by: ['institutionId', 'profileType'],
      where: { institutionId: { in: institutions.map((i) => i.id) } },
      _count: { _all: true },
    });

    const items = institutions.map((inst) => {
      const encadrants =
        counts.find((c) => c.institutionId === inst.id && c.profileType === 'ENCADRANT')?._count
          ._all ?? 0;
      const students =
        counts.find((c) => c.institutionId === inst.id && c.profileType === 'ETUDIANT')?._count
          ._all ?? 0;
      return { id: inst.id, name: inst.name, encadrants, students };
    });

    return NextResponse.json({ items }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
