// Admin — Gestion des documents — "fichiers orphelins".
//
// FileUpload (the generic Cloudinary upload ledger) has no foreign key to
// whatever eventually references it — Document.fileUrl, Message.
// attachmentUrl and User.avatarUrl are all just bare strings holding the
// secure_url Cloudinary returned (see schema.prisma's comment on
// Document.fileUrl). So "orphaned" can only be detected heuristically: a
// FileUpload row is orphaned if its Cloudinary public_id (`key`) does not
// appear as a substring of any fileUrl/attachmentUrl/avatarUrl in the
// database — i.e. storage was consumed but the two-step client flow
// (upload, then attach) never completed its second step.
//
// Scoped to a bounded, recent candidate window (not a full-table scan) for
// two reasons: cost, and correctness — a FileUpload row younger than
// GRACE_MS may simply be mid-flow (the attach POST hasn't landed yet), not
// actually orphaned.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const GRACE_MS = 60 * 60 * 1000; // 1h grace period before a FileUpload row is even considered
const CANDIDATE_LIMIT = 200;
const DISPLAY_LIMIT = 20;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const cutoff = new Date(Date.now() - GRACE_MS);

    // Sequential — Neon's DATABASE_URL pins connection_limit=1.
    const candidates = await prisma.fileUpload.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'desc' },
      take: CANDIDATE_LIMIT,
      select: {
        id: true,
        key: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        { scanned: 0, orphanCount: 0, orphans: [] },
        { headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const docMatches = await prisma.document.findMany({
      where: { OR: candidates.map((c) => ({ fileUrl: { contains: c.key } })) },
      select: { fileUrl: true },
    });
    const messageMatches = await prisma.message.findMany({
      where: { OR: candidates.map((c) => ({ attachmentUrl: { contains: c.key } })) },
      select: { attachmentUrl: true },
    });
    const userMatches = await prisma.user.findMany({
      where: { OR: candidates.map((c) => ({ avatarUrl: { contains: c.key } })) },
      select: { avatarUrl: true },
    });

    const usedUrls = [
      ...docMatches.map((d) => d.fileUrl),
      ...messageMatches.map((m) => m.attachmentUrl ?? ''),
      ...userMatches.map((u) => u.avatarUrl ?? ''),
    ];

    const orphans = candidates.filter((c) => !usedUrls.some((url) => url.includes(c.key)));

    return NextResponse.json(
      {
        scanned: candidates.length,
        orphanCount: orphans.length,
        orphans: orphans.slice(0, DISPLAY_LIMIT),
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
