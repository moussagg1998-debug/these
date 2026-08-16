// ThèseFacile — GET /api/documents/[id].
//
// Single-document lookup for the PDF viewer (/documents/[id]/view) — that
// page only has the document's id in its URL, not the owning thesis id.
// Both the student and the encadrant of the owning thesis may fetch it —
// unlike GET /api/documents, the encadrant-only cross-thesis aggregate.
// See docs/superpowers/specs/2026-08-15-document-pdf-annotations-design.md.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return NextResponse.json(
        { error: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const access = await resolveThesisAccess(prisma, document.thesisId, auth.user.sub);
    if (access instanceof NextResponse) return access;

    // The encadrant doesn't see a scheduled deposit until it's released — the
    // student (uploader) can always see their own, pending or not. Mirrors
    // GET /api/documents and GET /api/theses/[id]/documents: from the
    // encadrant's point of view a not-yet-released document simply doesn't
    // exist, so this returns the identical 404 shape rather than a
    // distinguishable "forbidden" error.
    if (
      access.encadrantId === auth.user.sub &&
      document.scheduledAt &&
      document.scheduledAt > new Date()
    ) {
      return NextResponse.json(
        { error: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    return NextResponse.json(document, { headers: { 'x-request-id': ctx.requestId } });
  });
}
