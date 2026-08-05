# Changer l'étape d'un étudiant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the encadrant change a student's thesis `stage` from `/students/[id]`, using the already-existing `PATCH /api/theses/[id]` endpoint (zero backend changes).

**Architecture:** Extract the 5 valid stage strings into one shared constant (`THESIS_STAGES` in `lib/theses.ts`), consumed by the existing Zod validator in the PATCH route and by a new inline stage-editor in `StudentProfileSidebar.tsx`. The editor follows the exact same toggle-open-form pattern already used by that file's "Envoyer un retour" composer. On successful save, a new `onStageChanged` callback prop bubbles up to `students/[id]/page.tsx`, which calls the existing `refreshThesis()` — both the sidebar badge and the "Étape actuelle" card on the main page re-render from the same refetched `thesis.stage`, no new state needed there.

**Tech Stack:** Next.js 16 App Router, React (client components), Zod, `@/lib/api` fetch wrapper, Tailwind v4, Vitest.

## Global Constraints

- All mutating calls go through the existing `api()` wrapper from `@/lib/api` (handles CSRF automatically) — never a raw `fetch`.
- No inline `style={{}}` — Tailwind utility classes only, matching every other block in the touched files.
- UI copy is French, inlined directly in JSX — matches the existing convention in `StudentProfileSidebar.tsx` (no central i18n constants file is used for this component).
- No new Prisma migration, no new API route, no new stage value ("Terminé" explicitly excluded — spec decision).
- No confirmation dialog before saving; no polling or real-time push (Ably) — spec decision, out of scope.
- `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build` must all pass before the final commit (CLAUDE.md's "before committing" gate).
- This codebase has **zero `.test.tsx` files** — React components are not unit-tested here; UI changes are verified via `typecheck`/`lint` plus a manual dev-server check (desktop + 375px mobile), matching the existing convention documented across every phase in `.planning/banani/STATUS.md`. Do not introduce React Testing Library or any new test tooling for this plan.

---

### Task 1: Extract `THESIS_STAGES` and consume it in the PATCH route

**Files:**
- Modify: `frontend/src/lib/theses.ts` (add export near `STAGE_COLORS`, current line 83)
- Modify: `frontend/src/app/api/theses/[id]/route.ts` (replace the local `STAGES` const, current lines 19–24)
- Test: `frontend/src/app/api/theses/[id]/route.test.ts` (already exists, already covers this — no new test, just a regression run)

**Interfaces:**
- Produces: `THESIS_STAGES: readonly ['En attente', 'Rédaction', 'Révision', 'Bloqué', 'Soutenance']`, exported from `@/lib/theses`. Task 2 imports this same constant to populate the `<select>` options — the two tasks must use the exact same import path and name.

This is a pure refactor (identical runtime behavior — same 5 strings, same order), so there's no new test to write. The existing `route.test.ts` already has tests for valid stage update (200), invalid stage value (400), and CSRF/auth failures — those tests are the regression check.

- [ ] **Step 1: Add the shared constant to `lib/theses.ts`**

Open `frontend/src/lib/theses.ts` and add this export directly above `STAGE_COLORS` (current line 83):

```ts
/**
 * The 5 valid `Thesis.stage` values, in the order shown in stage pickers.
 * Single source of truth — consumed by the PATCH /api/theses/[id] Zod
 * validator and by the encadrant's stage-change `<select>`.
 */
export const THESIS_STAGES = ['En attente', 'Rédaction', 'Révision', 'Bloqué', 'Soutenance'] as const;

export const STAGE_COLORS: Record<string, string> = {
  Rédaction: 'bg-secondary text-secondary-foreground',
  Révision: 'bg-warning text-warning-foreground',
  Soutenance: 'bg-success text-success-foreground',
  'En attente': 'bg-muted text-muted-foreground',
  Bloqué: 'bg-danger text-danger-foreground',
};
```

- [ ] **Step 2: Consume it in the PATCH route**

Open `frontend/src/app/api/theses/[id]/route.ts`. Current lines 9–24:

```ts
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveThesisAccess } from '@/lib/server/theses/guards';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const STAGES = ['En attente', 'Rédaction', 'Révision', 'Bloqué', 'Soutenance'] as const;

const PatchBody = z.object({
  stage: z.enum(STAGES).optional(),
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
import { THESIS_STAGES } from '@/lib/theses';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PatchBody = z.object({
  stage: z.enum(THESIS_STAGES).optional(),
  progress: z.number().int().min(0).max(100).optional(),
});
```

(The local `STAGES` const is deleted — `THESIS_STAGES` replaces it everywhere in this file.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter frontend run typecheck`
Expected: no errors (the `z.enum()` call still receives a readonly string-tuple, same shape as before).

- [ ] **Step 4: Run the existing route tests to confirm no regression**

Run: `pnpm --filter frontend exec vitest run "src/app/api/theses/[id]/route.test.ts"`
Expected: all tests PASS, including `'invalid stage value → 400 VALIDATION_FAILED'` and `'encadrant updates stage + progress → 200'`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/theses.ts "frontend/src/app/api/theses/[id]/route.ts"
git commit -m "refactor: extract THESIS_STAGES shared constant

Single source of truth for the 5 valid Thesis.stage values, replacing
the route-local copy. Prep for the encadrant stage-change UI in the
next commit, which needs the same list."
```

---

### Task 2: Add the stage-change control to `StudentProfileSidebar`

**Files:**
- Modify: `frontend/src/components/dashboard/StudentProfileSidebar.tsx`
- Modify: `frontend/src/app/students/[id]/page.tsx` (current lines 284–296)

**Interfaces:**
- Consumes: `THESIS_STAGES` from `@/lib/theses` (produced by Task 1). `api()`/`ApiError` from `@/lib/api` (already imported in this file). `useToast()` from `@/contexts/ToastContext` (already imported).
- Produces: new `onStageChanged?: () => void` prop on `StudentProfileSidebarProps` — the parent page wires it to `refreshThesis()`.

- [ ] **Step 1: Add the `THESIS_STAGES` import and the new prop**

Open `frontend/src/components/dashboard/StudentProfileSidebar.tsx`. Current lines 14–31:

```tsx
import {
  displayName,
  formatDate,
  type ThesisDeadline,
  type ThesisDocument,
  type ThesisPerson,
} from '@/lib/theses';

interface StudentProfileSidebarProps {
  thesisId: string;
  student: ThesisPerson;
  stage: string;
  progress: number;
  deadline?: ThesisDeadline | undefined;
  pendingComments: number;
  recentDocuments: ThesisDocument[];
  onCommentSent?: () => void;
}
```

Replace with:

```tsx
import {
  displayName,
  formatDate,
  THESIS_STAGES,
  type ThesisDeadline,
  type ThesisDocument,
  type ThesisPerson,
} from '@/lib/theses';

interface StudentProfileSidebarProps {
  thesisId: string;
  student: ThesisPerson;
  stage: string;
  progress: number;
  deadline?: ThesisDeadline | undefined;
  pendingComments: number;
  recentDocuments: ThesisDocument[];
  onCommentSent?: () => void;
  onStageChanged?: () => void;
}
```

- [ ] **Step 2: Destructure the new prop and add stage-editor state**

Current lines 33–47:

```tsx
export function StudentProfileSidebar({
  thesisId,
  student,
  stage,
  progress,
  deadline,
  pendingComments,
  recentDocuments,
  onCommentSent,
}: StudentProfileSidebarProps) {
  const { toast } = useToast();
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const name = displayName(student);
```

Replace with:

```tsx
export function StudentProfileSidebar({
  thesisId,
  student,
  stage,
  progress,
  deadline,
  pendingComments,
  recentDocuments,
  onCommentSent,
  onStageChanged,
}: StudentProfileSidebarProps) {
  const { toast } = useToast();
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState(stage);
  const [savingStage, setSavingStage] = useState(false);
  const name = displayName(student);
```

- [ ] **Step 3: Add the save handler**

Directly after the existing `onSend` function (current lines 49–64, ends right before the `return (`), add a new function:

```tsx
  async function onSaveStage(e: FormEvent) {
    e.preventDefault();
    setSavingStage(true);
    try {
      await api(`/api/theses/${thesisId}`, { method: 'PATCH', body: { stage: pendingStage } });
      toast('Étape mise à jour.', 'success');
      setStageEditorOpen(false);
      onStageChanged?.();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setSavingStage(false);
    }
  }
```

- [ ] **Step 4: Replace the static badge with the toggle editor**

Current lines 66–77 (the top block of the returned JSX):

```tsx
  return (
    <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col px-5 py-6 gap-6">
      <div className="flex items-start gap-4 pb-4 border-b border-border">
        <Avatar name={name} className="h-14 w-14 rounded-md" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{student.email}</div>
          <div className="text-xs font-medium text-secondary-foreground bg-secondary px-1.5 py-0.5 rounded-sm mt-1.5 inline-block">
            {stage}
          </div>
        </div>
      </div>
```

Replace with:

```tsx
  return (
    <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col px-5 py-6 gap-6">
      <div className="flex items-start gap-4 pb-4 border-b border-border">
        <Avatar name={name} className="h-14 w-14 rounded-md" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{student.email}</div>
          {stageEditorOpen ? (
            <form onSubmit={onSaveStage} className="flex flex-col gap-2 mt-2">
              <select
                value={pendingStage}
                onChange={(e) => setPendingStage(e.target.value)}
                className="border border-border rounded-sm px-2 py-1.5 text-xs text-foreground bg-input outline-none"
              >
                {THESIS_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingStage}
                  className="flex-1 px-2 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-sm disabled:opacity-50"
                >
                  {savingStage ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => setStageEditorOpen(false)}
                  className="px-2 py-1.5 border border-border text-foreground text-xs font-medium rounded-sm"
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="text-xs font-medium text-secondary-foreground bg-secondary px-1.5 py-0.5 rounded-sm inline-block">
                {stage}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingStage(stage);
                  setStageEditorOpen(true);
                }}
                className="text-xs font-medium text-primary underline"
              >
                Changer d&apos;étape
              </button>
            </div>
          )}
        </div>
      </div>
```

Note: `setPendingStage(stage)` runs every time the "Changer d'étape" button is clicked, not just once at mount — this guarantees the `<select>` always opens on the *current* stage, even if `stage` changed since the component mounted (e.g. after a previous edit refetched the thesis).

- [ ] **Step 5: Wire `onStageChanged` from the parent page**

Open `frontend/src/app/students/[id]/page.tsx`. Current lines 284–296:

```tsx
        <StudentProfileSidebar
          thesisId={thesis.id}
          student={thesis.student}
          stage={thesis.stage}
          progress={thesis.progress}
          deadline={deadline}
          pendingComments={thesis._count.comments}
          recentDocuments={(documents?.items ?? []).slice(0, 2)}
          onCommentSent={() => {
            void refreshComments();
            void refreshThesis();
          }}
        />
```

Replace with:

```tsx
        <StudentProfileSidebar
          thesisId={thesis.id}
          student={thesis.student}
          stage={thesis.stage}
          progress={thesis.progress}
          deadline={deadline}
          pendingComments={thesis._count.comments}
          recentDocuments={(documents?.items ?? []).slice(0, 2)}
          onCommentSent={() => {
            void refreshComments();
            void refreshThesis();
          }}
          onStageChanged={() => void refreshThesis()}
        />
```

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm --filter frontend run typecheck`
Expected: no errors.

Run: `pnpm --filter frontend run lint`
Expected: no errors (in particular, no `react-hooks/exhaustive-deps` or unused-var warnings — `pendingStage`/`savingStage`/`stageEditorOpen` are all used).

- [ ] **Step 7: Run the full test suite**

Run: `pnpm --filter frontend run test`
Expected: all tests pass (same count as before this plan — this task adds no new `.test.ts` files, per the Global Constraints note on this codebase having zero component tests).

- [ ] **Step 8: Manual verification on the dev server**

Run: `pnpm dev` (or reuse an already-running instance), then as a logged-in ENCADRANT with at least one student:

1. Open `/students/[id]` for that student at desktop width (≥1024px). Confirm the sidebar shows the stage badge + a "Changer d'étape" link next to it.
2. Click "Changer d'étape". Confirm a `<select>` appears, pre-selected to the student's current stage, with "Enregistrer"/"Annuler" buttons.
3. Pick a different stage, click "Enregistrer". Confirm: a success toast appears, the editor closes, the badge in the sidebar updates to the new stage, **and** the "Étape actuelle" card on the main column (left of the sidebar) also updates to the new stage — both without a page reload.
4. Reopen "Changer d'étape" and click "Annuler" without saving. Confirm the editor closes and the badge is unchanged.
5. Resize the browser to 375px (or use device toolbar). Confirm the sidebar stacks below the main content (full width) and the select + buttons are usable (no horizontal overflow, touch targets reasonably sized).
6. Navigate to `/students` and confirm the student now appears under the correct filter tab for their new stage (may require a page reload/revisit — this is expected per the spec's "correct on next load" scope, not a live cross-page update).

- [ ] **Step 9: Full pre-commit gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all green, per CLAUDE.md's "Before committing" requirement.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/dashboard/StudentProfileSidebar.tsx "frontend/src/app/students/[id]/page.tsx"
git commit -m "feat(students): let the encadrant change a student's thesis stage

Inline select in StudentProfileSidebar, same toggle-form pattern as
the existing comment composer. Reuses the already-shipped PATCH
/api/theses/[id] — no backend changes. Both the sidebar badge and the
main page's 'Étape actuelle' card update immediately via the existing
refreshThesis() refetch."
```

---

## Self-Review Notes

- **Spec coverage:** all 4 confirmed decisions are implemented — 5 existing stage values only (Task 1, no 6th value added anywhere), free transitions (plain `<select>` with all 5 options, Step 4), no confirmation dialog (direct save + toast, Step 3/4), "correct on next load" scope (no polling added, Step 8.6 explicitly checks this is a reload-based expectation, not live). The spec's `FilterBar.tsx` mention was scaled back after inspecting the real file: `STAGE_FILTERS` there is a differently-shaped array (UI ids + labels + a "Tous" entry with `stage: null`), not a bare list of stage strings — forcing it to consume `THESIS_STAGES` would add a mapping layer without reducing real duplication, so it's left untouched. `THESIS_STAGES` still has exactly 2 real consumers (the Zod validator and the new `<select>`), which was the actual goal (avoid a 3rd hardcoded copy).
- **Placeholder scan:** none — every step has literal code.
- **Type consistency:** `THESIS_STAGES` is defined once (Task 1, Step 1) and consumed with the same import path/name in Task 1 Step 2 and Task 2 Step 1. `onStageChanged` prop name matches between Task 2 Step 1 (interface), Step 2 (destructure), Step 3 (call site), and Step 5 (parent wiring).
