# Phase 5 — Échéances & Jalons — Banani → Next.js

## Source
- Banani flow: ThèseFacile (`YQWElzV_9JrI`).
- Screens: `DeadlineCalendar.jsx` ("Échéances — Calendrier"), `AddDeadline.jsx` ("Ajouter une échéance").
- Shared components: `DeadlineCard.jsx`, `AddDeadlineForm.jsx`.

## Routing decision — one screen, not two
Same shape as Phase 3's "Étudiant ajouté": `AddDeadline.jsx` is byte-for-byte the same `DeadlineCalendar` markup with `<AddDeadlineForm />` overlaid — it's "the calendar, with the add-modal open," not a distinct route. Built as one `/deadlines` page with an "Ajouter une échéance" button that opens the modal, exactly like `/students` + `AddStudentForm`.

## Field-scope gaps found + resolution
- **`DeadlineCard`'s `urgency` ("critical"/"urgent"/"upcoming"/"future") is not `Deadline.urgency`.** The schema's `urgency` field ("low"/"medium"/"high") is a value the *encadrant sets* when creating a deadline (how important it is). Banani's card `urgency` prop is *derived from days-until-due* — a different axis entirely (a "low" priority deadline that's overdue still needs to render as "critical"). Added `deadlineUrgencyBucket(dueAt)` to `lib/theses.ts`: `< 0d → critical`, `0–7d → urgent`, `8–60d → upcoming`, `> 60d → future` (boundaries inferred from Banani's own example data: -15/-8/-2 critical, 3/5/7 urgent, 32/42 upcoming, 195 future).
- **`AddDeadlineForm` splits "Chapitre ou livrable" (required, short) from "Description (optionnel)" (long free text)** — the schema only had `title`. `title` keeps the chapter/livrable semantics (already used that way by existing `POST /api/theses/[id]/deadlines` callers); added `Deadline.description String?` for the optional long-form note.
- **"Priorité" buttons (Normale/Haute/Urgente) map 1:1 onto the existing `urgency` enum** — Normale→`low`, Haute→`medium`, Urgente→`high`. No schema change; just French labels distinct from the internal values (same pattern as the stage picker in `AddStudentForm`).
- **"Envoyer un rappel 3 jours avant" checkbox has no backend behind it.** A real reminder needs a scheduler (a cron scanning `Deadline.dueAt` and firing notifications N days out) — genuine scope, not a field add, and not what was asked for this phase. Rendered **disabled** with a "Bientôt disponible" tooltip, same treatment as Phase 4's "Non lus" filter and Phase 3's "Plus d'options" — visibly inert rather than silently doing nothing after being checked.

## Backend
- `GET /api/deadlines` — **new**, encadrant-only, cross-thesis aggregate (same reason as Phase 4's `/api/documents`/`/api/comments`: no single-thesis scope fits a calendar across every student). Unlike those two, this is **not cursor-paginated** — a calendar view needs "all upcoming + overdue items grouped by bucket," not an infinite-scroll feed, and the realistic row count (a handful of deadlines × however many students) doesn't need it. Capped at `take: 200` as a sanity ceiling, ordered by `dueAt` ascending.
- `POST /api/theses/[id]/deadlines` (existing, Phase 1) — extended with optional `description`. Creation still goes through the per-thesis nested route (the modal's "Étudiant" picker just selects *which* thesis to POST to) — no new POST route needed.

## Component breakdown
- **NEW** `src/components/dashboard/DeadlineCard.tsx` — port of Banani's card, wired to a real `Deadline` + parent `thesis.student`.
- **NEW** `src/components/dashboard/AddDeadlineForm.tsx` — modal, mirrors `AddStudentForm`'s shape (student picker populated from `/api/theses`, then `POST /api/theses/{id}/deadlines`).
- **REUSE** `DashboardShell`, `Sidebar` (already has `/deadlines` nav entry from Phase 3), `Avatar`, `Icon`, `useToast`.

## Screens

### Échéances — Calendrier → `/deadlines` (frontend/src/app/deadlines/page.tsx)
Client component, encadrant-gated (same pattern as `/documents`/`/comments`). Fetches `GET /api/deadlines` once; buckets client-side via `deadlineUrgencyBucket`. Filter tabs (Tous/Critiques/Ce mois/Prochains mois) filter the same fetched set client-side — same FilterBar-counts pattern as Phase 3/4. Sections render only when non-empty (Banani always has all 3; an encadrant with no overdue items shouldn't see an empty "En retard" heading).

## Responsive plan
Both screens are `screenSize: 'desktop'`.
- **Base (375px)**: `DeadlineCard`'s header row (name/description vs. days-left badge) wraps (`flex-wrap`) instead of Banani's `justify-between` — a long description won't fit beside a badge at 375px. Filter tabs scroll horizontally (`overflow-x-auto`, same as every prior phase's tab row). `AddDeadlineForm` modal already sizes via `w-96 max-w-full`, no change needed (validated pattern from `AddStudentForm`).
- **lg (1024px+)**: Banani's fetched desktop layout.

## Deliberate simplifications (flagged, not silent)
- No real reminder delivery — the checkbox is present but disabled.
- No "mark as done" / resolve action on a deadline — Banani's own `DeadlineCard` doesn't show one either (comments have `resolved`, deadlines don't).
- `/api/deadlines` is uncapped-by-cursor (simple `take: 200`) rather than following the Phase 4 cursor-pagination pattern — deliberate, see Backend section.

## Implementation checklist
- [x] Schema: `Deadline.description` + migration (`20260803233622_thesefacile_deadline_description`)
- [x] `GET /api/deadlines`, extend `POST /api/theses/[id]/deadlines` + tests
- [x] `DeadlineCard`, `AddDeadlineForm` components
- [x] `/deadlines` page
- [x] Dashboard's "Prochaines échéances" panel gets a "Voir tout" link to `/deadlines` (parity with the students table's existing link)
- [ ] 375/768/1280 check — **not verified**, same caveat as every prior phase, no browser tool in this session
- [x] `pnpm format && lint && typecheck && test && build`
