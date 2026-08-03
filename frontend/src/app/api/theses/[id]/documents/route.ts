// ThèseFacile — GET + POST /api/theses/[id]/documents.
//
// "Bibliothèque de documents" (encadrant) + "Dépôt de fichier étudiant".
// Storage itself is NOT reinvented here — the client uploads to Cloudinary
// via the existing /api/upload route first, then POSTs the resulting URL
// here to attach it to the thesis. Only the student deposits documents in
// the Banani flow; the encadrant reads them.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { createNotification } from '@/lib/server/notifications';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const CreateBody = z.object({
  fileUrl: z.string().url(),
  chapter: z.string().trim().max(200).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const access = await resolveThesisAccess(prisma, id, auth.user.sub);
    if (access instanceof NextResponse) return access;

    const documents = await prisma.document.findMany({
      where: { thesisId: id },
      orderBy: [{ uploadedAt: 'desc' }],
    });

    return NextResponse.json({ items: documents }, { headers: { 'x-request-id': ctx.requestId } });
  });
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const access = await resolveThesisAccess(prisma, id, auth.user.sub);
    if (access instanceof NextResponse) return access;
    if (access.studentId !== auth.user.sub) {
      return NextResponse.json(
        { error: 'STUDENT_ONLY', message: 'Only the student can deposit documents' },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid request body',
          issues: parsed.error.issues,
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const document = await prisma.document.create({
      data: {
        thesisId: id,
        fileUrl: parsed.data.fileUrl,
        ...(parsed.data.chapter !== undefined ? { chapter: parsed.data.chapter } : {}),
      },
    });

    try {
      await createNotification(prisma, {
        userId: access.encadrantId,
        type: 'DOCUMENT_SUBMITTED',
        title: 'Nouveau document déposé',
        body: parsed.data.chapter
          ? `Nouveau dépôt : ${parsed.data.chapter}`
          : 'Nouveau document déposé',
        data: { thesisId: id, documentId: document.id },
        dedupeKey: `document-submitted:${document.id}`,
      });
    } catch {
      // Notification is best-effort — the document is already committed.
    }

    return NextResponse.json(document, { status: 201, headers: { 'x-request-id': ctx.requestId } });
  });
}
