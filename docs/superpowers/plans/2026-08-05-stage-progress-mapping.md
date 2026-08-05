# Progression dérivée de l'étape — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Thesis.progress` auto-derive from `Thesis.stage` — a fixed percentage per stage, computed server-side, so the "Avancement" bar fills in whenever the encadrant changes a student's stage (instead of staying frozen at 0).

**Architecture:** Add one shared mapping (`STAGE_PROGRESS`) and one pure helper (`deriveProgress(stage, currentProgress)`) to `lib/theses.ts` — the single source of truth for turning a stage into a percentage. `PATCH /api/theses/[id]` stops accepting `progress` as client input and instead computes it from the new stage every time `stage` is part of the request. `POST /api/theses` does the same at creation time when an initial `stage` is supplied. No UI changes: `StudentProfileSidebar.tsx` already sends `{ stage }` only and already re-renders `thesis.progress` after `refreshThesis()`.

**Tech Stack:** Next.js 16 App Router Route Handlers, Zod, Prisma 5, Vitest.

## Global Constraints

- `deriveProgress` in `frontend/src/lib/theses.ts` is the **only** place that computes `progress` from `stage` — no other file re-implements this mapping.
- Mapping: `En attente` → 0, `Rédaction` → 40, `Révision` → 75, `Soutenance` → 100. `Bloqué` is deliberately absent from `STAGE_PROGRESS` — `deriveProgress` falls back to `currentProgress` unchanged for it (spec decision: Bloqué isn't a linear progress step).
- `PATCH /api/theses/[id]`'s request body no longer accepts a `progress` field — only `stage` (optional) is a valid input. Sending `progress` in the body is silently dropped by Zod (default `z.object` behavior — no `.strict()`), not a validation error.
- `POST /api/theses`: when `stage` is supplied at creation, `progress = deriveProgress(stage, 0)` (0 = the Prisma default, there's no "previous" value at creation).
- No Prisma migration — `progress` stays a plain `Int`.
- No UI/component changes — `StudentProfileSidebar.tsx` is out of scope for this plan.
- `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build` must all pass before the final commit (CLAUDE.md's "before committing" gate).

---

### Task 1: Add `STAGE_PROGRESS`/`deriveProgress` and consume in the PATCH route

**Files:**
- Modify: `frontend/src/lib/theses.ts` (add export near `STAGE_COLORS`, current line 96-102)
- Modify: `frontend/src/app/api/theses/[id]/route.ts`
- Test: `frontend/src/app/api/theses/[id]/route.test.ts`

**Interfaces:**
- Produces: `STAGE_PROGRESS: Partial<Record<(typeof THESIS_STAGES)[number], number>>` and `deriveProgress(stage: (typeof THESIS_STAGES)[number], currentProgress: number): number`, both exported from `@/lib/theses`. Task 2 imports the same `deriveProgress` — same name, same import path.

- [ ] **Step 1: Add the mapping + helper to `lib/theses.ts`**

Open `frontend/src/lib/theses.ts`. Current lines 96-102:

```ts
export const STAGE_COLORS: Record<string, string> = {
  Rédaction: 'bg-secondary text-secondary-foreground',
  Révision: 'bg-warning text-warning-foreground',
  Soutenance: 'bg-success text-success-foreground',
  'En attente': 'bg-muted text-muted-foreground',
  Bloqué: 'bg-danger text-danger-foreground',
};
```

Add directly below it:

```ts
/**
 * Fixed progress percentage per stage — the only place `Thesis.progress` is
 * computed from `Thesis.stage`. `Bloqué` is deliberately absent: it isn't a
 * linear progress step (it can happen at any point), so `deriveProgress`
 * falls back to the current value instead of overwriting it.
 */
export const STAGE_PROGRESS: Partial<Record<(typeof THESIS_STAGES)[number], number>> = {
  'En attente': 0,
  Rédaction: 40,
  Révision: 75,
  Soutenance: 100,
};

export function deriveProgress(
  stage: (typeof THESIS_STAGES)[number],
  currentProgress: number,
): number {
  return STAGE_PROGRESS[stage] ?? currentProgress;
}
```

- [ ] **Step 2: Consume it in the PATCH route**

Open `frontend/src/app/api/theses/[id]/route.ts`. Current lines 9-23:

```ts
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { THESIS_STAGES } from '@/lib/theses';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PatchBody = z.object({
  stage: z.enum(THESIS_STAGES).optional(),
  progress: z.number().int().min(0).max(100).optional(),
});
```

Replace with:

```ts
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { deriveProgress, THESIS_STAGES } from '@/lib/theses';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PatchBody = z.object({
  stage: z.enum(THESIS_STAGES).optional(),
});
```

Now open the same file's `PATCH` function body. Current lines 86-92:

```ts
    const thesis = await prisma.thesis.update({
      where: { id },
      data: {
        ...(parsed.data.stage !== undefined ? { stage: parsed.data.stage } : {}),
        ...(parsed.data.progress !== undefined ? { progress: parsed.data.progress } : {}),
      },
    });
```

Replace with:

```ts
    const thesis = await prisma.thesis.update({
      where: { id },
      data:
        parsed.data.stage !== undefined
          ? { stage: parsed.data.stage, progress: deriveProgress(parsed.data.stage, access.progress) }
          : {},
    });
```

`access` is the `Thesis` row already loaded by `resolveThesisAccess` earlier in this same function (line 65: `const access = await resolveThesisAccess(prisma, id, auth.user.sub);`) — it carries the thesis's current `progress`, so no extra query is needed.

- [ ] **Step 3: Update the PATCH test file**

Open `frontend/src/app/api/theses/[id]/route.test.ts`. Current lines 21-30:

```ts
function thesisRow(overrides: Partial<{ studentId: string; encadrantId: string }> = {}) {
  return {
    id: 'thesis-1',
    topic: 'Sujet',
    stage: 'En attente',
    progress: 0,
    studentId: overrides.studentId ?? 'stu-1',
    encadrantId: overrides.encadrantId ?? 'enc-1',
  };
}
```

Replace with (adds an overridable `progress`, needed to set up different "current progress" fixtures for the Bloqué case below):

```ts
function thesisRow(
  overrides: Partial<{ studentId: string; encadrantId: string; progress: number }> = {},
) {
  return {
    id: 'thesis-1',
    topic: 'Sujet',
    stage: 'En attente',
    progress: overrides.progress ?? 0,
    studentId: overrides.studentId ?? 'stu-1',
    encadrantId: overrides.encadrantId ?? 'enc-1',
  };
}
```

Current lines 104-111 (the last test in the `PATCH` describe block):

```ts
  it('encadrant updates stage + progress → 200', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ stage: 'Rédaction', progress: 40 }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({ stage: 'Rédaction', progress: 40 });
  });
});
```

Replace with (drops the old "client sends progress" case — that input no longer exists — and adds the derivation, Bloqué-preserves, and no-op-body cases from the spec):

```ts
  it.each([
    ['En attente', 0],
    ['Rédaction', 40],
    ['Révision', 75],
    ['Soutenance', 100],
  ] as const)('stage → %s derives progress %i, ignoring current progress', async (stage, expected) => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', progress: 10 }) as never,
    );
    prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ stage }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({ stage, progress: expected });
  });

  it('stage → Bloqué preserves the thesis\'s existing progress value', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', progress: 40 }) as never,
    );
    prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ stage: 'Bloqué' }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({ stage: 'Bloqué', progress: 40 });
  });

  it('a client-supplied progress field is ignored — only stage drives it', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', progress: 10 }) as never,
    );
    prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({ stage: 'Rédaction', progress: 99 }), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({ stage: 'Rédaction', progress: 40 });
  });

  it('stage absent (empty body) → no fields updated', async () => {
    prismaMock.thesis.findUnique.mockResolvedValue(
      thesisRow({ encadrantId: 'user-1', progress: 40 }) as never,
    );
    prismaMock.thesis.update.mockResolvedValue(thesisRow({ encadrantId: 'user-1' }) as never);
    const res = await PATCH(makePatch({}), { params });
    expect(res.status).toBe(200);
    const updateArg = prismaMock.thesis.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual({});
  });
});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter frontend run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the PATCH test file**

Run: `pnpm --filter frontend exec vitest run "src/app/api/theses/[id]/route.test.ts"`
Expected: all tests PASS (the 3 unaffected tests — csrf, encadrant-only, invalid stage — plus the 4 new `PATCH` cases: 4 stage-mapping sub-cases via `it.each`, Bloqué-preserves, progress-ignored, and empty-body no-op).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/theses.ts "frontend/src/app/api/theses/[id]/route.ts" "frontend/src/app/api/theses/[id]/route.test.ts"
git commit -m "feat(theses): derive progress from stage on PATCH

Adds STAGE_PROGRESS + deriveProgress in lib/theses.ts as the single
source of truth. PATCH /api/theses/[id] no longer accepts progress as
client input — it's computed from the new stage every time, except
Bloqué which preserves the existing value (not a linear progress
step)."
```

---

### Task 2: Derive initial progress on `POST /api/theses`

**Files:**
- Modify: `frontend/src/app/api/theses/route.ts`
- Test: `frontend/src/app/api/theses/route.test.ts`

**Interfaces:**
- Consumes: `deriveProgress` from `@/lib/theses` (produced by Task 1).

- [ ] **Step 1: Consume `deriveProgress` in the POST route**

Open `frontend/src/app/api/theses/route.ts`. Current line 28:

```ts
import { THESIS_STAGES } from '@/lib/theses';
```

Replace with:

```ts
import { deriveProgress, THESIS_STAGES } from '@/lib/theses';
```

Current lines 140-157 (the `prisma.thesis.create` call):

```ts
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
```

Replace the `...(parsed.data.stage ? { stage: parsed.data.stage } : {})` line with a version that also derives `progress`:

```ts
    const thesis = await prisma.thesis.create({
      data: {
        topic: parsed.data.topic,
        studentId: student.id,
        encadrantId: auth.user.sub,
        ...(parsed.data.stage
          ? { stage: parsed.data.stage, progress: deriveProgress(parsed.data.stage, 0) }
          : {}),
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
```

(When `stage` isn't supplied, both `stage` and `progress` keep their Prisma defaults — "En attente" / 0 — which are already consistent with each other, so no change needed for that branch.)

- [ ] **Step 2: Add the POST test**

Open `frontend/src/app/api/theses/route.test.ts`. Directly after the existing `it('accepts optional stage + deadlineAt and nests a Deadline create', ...)` test (ends at current line 203 with `});`, right before `it('rejects an unknown stage value...`), add:

```ts
  it('creating with an initial stage derives its progress too', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ profileType: 'ENCADRANT' } as never)
      .mockResolvedValueOnce({ id: 'stu-1', profileType: null } as never);
    prismaMock.thesis.findFirst.mockResolvedValue(null);
    prismaMock.thesis.create.mockResolvedValue({
      id: 'thesis-1',
      topic: 'Impact de X',
      stage: 'Révision',
      progress: 75,
      studentId: 'stu-1',
      encadrantId: 'user-1',
    } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    const res = await POST(
      makePost({ studentEmail: 'a@b.com', topic: 'Impact de X', stage: 'Révision' }),
    );
    expect(res.status).toBe(201);
    const createArg = prismaMock.thesis.create.mock.calls[0]?.[0];
    expect(createArg?.data?.stage).toBe('Révision');
    expect(createArg?.data?.progress).toBe(75);
  });
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter frontend run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the POST test file**

Run: `pnpm --filter frontend exec vitest run "src/app/api/theses/route.test.ts"`
Expected: all tests PASS, including the new "creating with an initial stage derives its progress too" case.

- [ ] **Step 5: Lint**

Run: `pnpm --filter frontend run lint`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `pnpm --filter frontend run test`
Expected: all tests pass (696 + the new cases added in Task 1 Step 3 and this task's Step 2 — no other file should regress).

- [ ] **Step 7: Manual verification on the dev server**

Run: `pnpm dev` (or reuse an already-running instance), then as a logged-in ENCADRANT with at least one student:

1. Open `/students/[id]`. Note the current "Avancement" %.
2. Click "Changer d'étape", pick "Rédaction", save. Confirm the progress bar (both the sidebar area and the "Étape actuelle" card) jumps to 40% immediately, no reload.
3. Change to "Révision" → confirm 75%. Change to "Soutenance" → confirm 100%.
4. Change to "Bloqué" → confirm the percentage stays at 100% (unchanged from the previous step, not reset to 0).
5. Change back to "En attente" → confirm 0%.
6. Navigate to `/students` and reload — confirm the "Avancement" bar for this student matches the last-saved stage's percentage (list page updates on next load, per the existing stage-change spec's scope).

- [ ] **Step 8: Full pre-commit gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all green, per CLAUDE.md's "Before committing" requirement.

- [ ] **Step 9: Commit**

```bash
git add "frontend/src/app/api/theses/route.ts" "frontend/src/app/api/theses/route.test.ts"
git commit -m "feat(theses): derive initial progress from stage on creation

POST /api/theses now applies the same deriveProgress mapping used by
the PATCH route when an initial stage is supplied at creation, so a
thesis created directly into e.g. 'Révision' doesn't start at an
inconsistent 0%."
```

---

## Self-Review Notes

- **Spec coverage:** mapping table (Task 1 Step 1) matches the spec's 4 fixed values + Bloqué's fallback-to-current behavior, verified by Task 1 Step 3's `it.each` + Bloqué test. Server-side single source of truth (Task 1 Step 2 removes `progress` from `PatchBody`, verified by the new "client-supplied progress field is ignored" test). POST consistency (Task 2) covers the spec's "création avec stage: 'Révision' → progress: 75" case verbatim. No UI changes (spec's "Aucun changement UI" section) — no component file appears in either task's Files list. No Prisma migration — schema.prisma isn't touched.
- **Placeholder scan:** none — every step has literal code.
- **Type consistency:** `deriveProgress(stage, currentProgress)` signature is identical everywhere it's used — defined in Task 1 Step 1, consumed in Task 1 Step 2 (`deriveProgress(parsed.data.stage, access.progress)`) and Task 2 Step 1 (`deriveProgress(parsed.data.stage, 0)`). `STAGE_PROGRESS` keys match `THESIS_STAGES` values exactly (same 4 strings, `Bloqué` intentionally omitted per the type being `Partial`).
