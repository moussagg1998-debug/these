// ThèseFacile — GET + POST /api/theses.
//
// GET: list "mine" — encadrant sees theses where they are the encadrant,
// étudiant sees their own (at most one, per the confirmed MVP decision:
// one active thesis per student). Cursor-paginated like every other list
// route in the codebase (createdAt/id via the shared pagination helper).
//
// POST: "Ajouter un étudiant" (Banani) — encadrant-only. The student must
// already have a registered account (MVP simplification documented in
// IMPLEMENTATION-PLAN.md — no invite-by-email flow yet). One thesis per
// student is enforced here, not at the DB level, so a future "thesis
// history" feature doesn't require a schema migration. `stage`/`deadlineAt`
// are optional (mirror the Banani "Ajouter un étudiant" modal's Étape
// actuelle / Échéance estimée fields) — the modal's "Nom complet" field is
// intentionally NOT part of this contract: the student's name always comes
// from their own account, not encadrant input.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { requireProfileType } from '@/lib/server/theses/guards';
import { createNotification } from '@/lib/server/notifications';
import { zEmail } from '@/lib/server/zod-helpers';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const CreateBody = z.object({
  studentEmail: zEmail,
  topic: z.string().trim().min(1).max(500),
  stage: z.enum(['En attente', 'Rédaction', 'Révision', 'Bloqué', 'Soutenance']).optional(),
  deadlineAt: z.coerce.date().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const profile = await requireProfileType(prisma, auth.user.sub, ['ENCADRANT', 'ETUDIANT']);
    if (profile instanceof NextResponse) return profile;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const scopeField = profile.profileType === 'ENCADRANT' ? 'encadrantId' : 'studentId';
    const where: Prisma.ThesisWhereInput = {
      [scopeField]: auth.user.sub,
      ...cursorWhere(cursor),
    };

    const rows = await prisma.thesis.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        student: { select: { id: true, name: true, email: true, avatarUrl: true } },
        // bio: Phase 10's encadrant "Profil" tab — surfaced to students via
        // the "Mon encadrant" cards (StudentDashboardContent, StudentMessagingContent).
        encadrant: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true } },
        // "Mes étudiants" table (Banani StudentRow) needs a last-submission
        // timestamp and a next-deadline chip — both are derived from real
        // rows rather than modeled as columns on Thesis itself.
        documents: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        deadlines: { where: { dueAt: { gte: new Date() } }, orderBy: { dueAt: 'asc' }, take: 1 },
        // Banani's "pendingComments" assumes a resolved/unresolved concept
        // the schema doesn't model yet (see Comment in schema.prisma) — this
        // MVP substitutes a plain total comment count per thesis.
        _count: { select: { comments: true } },
      },
    });

    return NextResponse.json(buildPage(rows, limit), {
      headers: { 'x-request-id': ctx.requestId },
    });
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const profile = await requireProfileType(prisma, auth.user.sub, ['ENCADRANT']);
    if (profile instanceof NextResponse) return profile;

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

    const student = await prisma.user.findUnique({
      where: { email: parsed.data.studentEmail },
      select: { id: true, profileType: true },
    });
    if (!student) {
      return NextResponse.json(
        { error: 'STUDENT_NOT_FOUND', message: 'No account with this email yet' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    if (student.profileType && student.profileType !== 'ETUDIANT') {
      return NextResponse.json(
        { error: 'NOT_A_STUDENT', message: 'This account is not a student profile' },
        { status: 422, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const existing = await prisma.thesis.findFirst({ where: { studentId: student.id } });
    if (existing) {
      return NextResponse.json(
        { error: 'THESIS_ALREADY_EXISTS', message: 'This student already has a thesis' },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const thesis = await prisma.thesis.create({
      data: {
        topic: parsed.data.topic,
        studentId: student.id,
        encadrantId: auth.user.sub,
        ...(parsed.data.stage ? { stage: parsed.data.stage } : {}),
        ...(parsed.data.deadlineAt
          ? {
              deadlines: {
                create: {
                  title: 'Échéance initiale',
                  dueAt: parsed.data.deadlineAt,
                  urgency: 'medium',
                },
              },
            }
          : {}),
      },
      include: {
        student: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    try {
      await createNotification(prisma, {
        userId: student.id,
        type: 'THESIS_ASSIGNED',
        title: 'Nouvel encadrant assigné',
        body: `Vous avez été ajouté(e) comme étudiant(e) pour : ${thesis.topic}`,
        data: { thesisId: thesis.id },
        dedupeKey: `thesis-assigned:${thesis.id}`,
      });
    } catch {
      // Notification is best-effort — the thesis is already committed.
    }

    return NextResponse.json(thesis, { status: 201, headers: { 'x-request-id': ctx.requestId } });
  });
}
