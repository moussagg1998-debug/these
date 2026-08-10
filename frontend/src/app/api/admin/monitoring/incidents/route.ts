// GET /api/admin/monitoring/incidents — Admin → Monitoring's paginated
// incident history table. Cursor-paginated via the shared pagination
// helper (same idiom as GET /api/theses), optional ?service=/?status=
// filters.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { SERVICE_KEYS } from '@/lib/server/monitoring/types';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const serviceParam = url.searchParams.get('service');
    const statusParam = url.searchParams.get('status');

    const filters: Prisma.MonitoringIncidentWhereInput = {};
    if (serviceParam && (SERVICE_KEYS as readonly string[]).includes(serviceParam)) {
      filters.service = serviceParam;
    }
    if (statusParam === 'OPEN' || statusParam === 'ACKNOWLEDGED' || statusParam === 'RESOLVED') {
      filters.status = statusParam;
    }

    const where: Prisma.MonitoringIncidentWhereInput = { ...filters, ...cursorWhere(cursor) };

    const rows = await prisma.monitoringIncident.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return NextResponse.json(buildPage(rows, limit), {
      headers: { 'x-request-id': ctx.requestId },
    });
  });
}
