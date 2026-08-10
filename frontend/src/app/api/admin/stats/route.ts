// GET /api/admin/stats — ThèseFacile admin dashboard KPI grid (Option A
// scope, see .planning/banani/admin-dashboard.md). Only the 3 metrics with
// real backing data — "Universités actives" / "MRR" / "Comptes inactifs"
// are deliberately absent (no active/inactive concept on Institution, no
// subscription model, no lastLoginAt tracking anywhere in the schema).
//
// Three sequential counts, never Promise.all — see institutions/route.ts's
// note on Neon's connection_limit=1.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const encadrants = await prisma.user.count({ where: { profileType: 'ENCADRANT' } });
    const etudiants = await prisma.user.count({ where: { profileType: 'ETUDIANT' } });
    const theses = await prisma.thesis.count({ where: { archivedAt: null } });

    return NextResponse.json(
      { encadrants, etudiants, theses },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
