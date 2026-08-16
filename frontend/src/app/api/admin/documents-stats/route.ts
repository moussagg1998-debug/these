// Admin — Gestion des documents — aggregate KPI counts for the
// /admin/documents dashboard. Mirrors email-stats/route.ts's exact shape
// (sequential prisma calls — Neon connection_limit=1, requireAdmin('ADMIN')
// + enforceAdminRateLimit, fixed reporting window).
//
// Two different tables feed this route on purpose:
//   - Document (thesis-scoped deposits) backs `documentCount` and `recent`
//     — that's the literal "documents" the page is named after.
//   - FileUpload (the generic Cloudinary upload ledger — also fed by
//     avatars and message attachments, see schema.prisma's comment on
//     Document.fileUrl) backs `storageBytes`/`avgFileSizeBytes`, because
//     FileUpload.sizeBytes is always populated at upload time while
//     Document.sizeBytes is optional and frequently null. This makes the
//     storage figures MORE accurate, at the cost of also counting avatars/
//     attachments — the page labels these cards accordingly rather than
//     silently presenting a document-only number that isn't one.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h — matches every other admin KPI window in this repo
const WINDOW_HOURS = 24;
const RECENT_DOCS_LIMIT = 5;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const since = new Date(Date.now() - WINDOW_MS);

    // Sequential — Neon's DATABASE_URL pins connection_limit=1 (same
    // rationale as every other multi-query admin route in this repo).
    const documentCount = await prisma.document.count();

    const recentDocuments = await prisma.document.findMany({
      orderBy: [{ uploadedAt: 'desc' }],
      take: RECENT_DOCS_LIMIT,
      select: {
        id: true,
        chapter: true,
        fileName: true,
        sizeBytes: true,
        uploadedAt: true,
        thesis: { select: { topic: true, student: { select: { name: true, email: true } } } },
      },
    });

    const storageAgg = await prisma.fileUpload.aggregate({ _sum: { sizeBytes: true } });
    const avgAgg = await prisma.fileUpload.aggregate({ _avg: { sizeBytes: true } });

    const uploadErrors24h = await prisma.uploadErrorEvent.count({
      where: { source: 'VALIDATION', createdAt: { gte: since } },
    });
    const cloudinaryErrors24h = await prisma.uploadErrorEvent.count({
      where: { source: 'CLOUDINARY', createdAt: { gte: since } },
    });

    return NextResponse.json(
      {
        windowHours: WINDOW_HOURS,
        documentCount,
        recentDocuments: recentDocuments.map((d) => ({
          id: d.id,
          chapter: d.chapter,
          fileName: d.fileName,
          sizeBytes: d.sizeBytes,
          uploadedAt: d.uploadedAt,
          thesisTopic: d.thesis.topic,
          studentName: d.thesis.student.name ?? d.thesis.student.email,
        })),
        storageBytes: storageAgg._sum.sizeBytes ?? 0,
        avgFileSizeBytes: avgAgg._avg.sizeBytes ? Math.round(avgAgg._avg.sizeBytes) : 0,
        uploadErrors24h,
        cloudinaryErrors24h,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
