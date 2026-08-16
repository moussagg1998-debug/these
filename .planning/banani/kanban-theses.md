# Kanban — Étapes de thèse — Banani → Next.js

## Source
- Banani screen: `KanbanTheses.jsx`, `displayName: 'Kanban — Étapes de thèse'`, `screenSize: desktop`.
- Uses the shared `Sidebar` component (`active="students"`) — confirms this is a view mode of the existing "Mes étudiants" section, not a new top-level nav item.

## Routing decision — nested under `/students`, same pattern as Phase 16
`/students/kanban`, ENCADRANT-only (mirrors `/students/reminders`'s routing precedent — a sub-view reached via a button, not a persistent Sidebar entry). No new `Sidebar.NAV_ITEMS` entry; the Sidebar's "Mes étudiants" item stays active (via `isNavItemActive` prefix match, same as `/students/reminders` today).

## System findings — zero new backend needed
- `GET /api/theses` (already consumed by `/dashboard` and `/students`) already returns everything a Kanban card needs: `stage`, `topic`, `student`, `deadlines[0].dueAt`, `_count.comments`. Fetched with `?limit=50` (the route's `MAX_LIMIT`), same precedent as Phase 16 reusing this endpoint for the reminders recipient list.
- `THESIS_STAGES` (`lib/theses.ts`) already enumerates the 5 stages Banani's 5 columns map to 1:1 — no new enum, no schema change.
- `urgencyFromDueDate()` (`lib/theses.ts`) already computes the low/medium/high urgency dot Banani shows per card, from `deadlines[0].dueAt` — reused as-is.
- Column order in the Banani source is En attente → Rédaction → Révision → **Soutenance → Bloqué**, which differs from `THESIS_STAGES`' own array order (`Bloqué` before `Soutenance`, used elsewhere for stage-picker dropdowns). Kept **local to this screen's own column list** rather than reordering the shared array (which other screens depend on) — Banani's visual order (Bloqué last, an exceptional state) is followed here only.

## Component breakdown
- **NEW** `src/app/students/kanban/page.tsx` — the board.
- **NEW** `src/components/dashboard/KanbanCard.tsx` — one thesis card (avatar, name, urgency dot, topic, deadline, comment count) — links to `/students/[id]`.
- **REUSE** `Sidebar`, `DashboardShell`, `DashboardHeader` (no `search` prop — user asked to remove the filter bar on 2026-08-08; see "Deviations from Banani" below), `Avatar`, `Icon`, `AddStudentForm` (opened by every "+"/"Ajouter un étudiant" affordance — Banani shows per-column add links with no real destination; since a new thesis always starts at `En attente` per the schema default, wiring all of them to the same existing modal is the honest choice rather than fabricating per-column pre-seeding).
- **REUSE** `urgencyFromDueDate`, `THESIS_STAGES`-shaped local column list, `displayName`, `formatDate` from `lib/theses.ts`.

## Entry points (this task's actual ask)
- **NEW** "Kanban" button on `/dashboard` (Encadrant) — added to the "Mes thèses & mémoires" section's action row, next to the existing "Voir tout"/"Ajouter un étudiant" buttons (`DashboardEncadrantPage`).
- **NEW** "Kanban" button on `/students` — added via `DashboardHeader`'s `actions` slot (already exists, unused today), next to the existing "Ajouter un étudiant" button.
- Both are plain `<Link href="/students/kanban">`, ghost/outline style matching the existing "Voir tout" button convention already used on both pages.

## Responsive plan
`screenSize: desktop` in Banani; 5 fixed-width columns (`w-56` each ≈ 1150px minimum) don't reflow to a single column on mobile — this is a genuine Kanban-board constraint, not a shortcut. Standard, honest mobile pattern for this UI shape (same as Trello/Linear mobile): the column row scrolls horizontally within its own `overflow-x-auto` container at **every** breakpoint (375/768/1280), never the page itself. No breakpoint-gated layout change needed — same markup renders correctly from 375px up because the scroll container, not a grid reflow, absorbs the width difference.

## Interactions / state
- Loading: "Chargement…" (matches every other Encadrant page).
- Empty column: "Aucun étudiant à cette étape." per column, not a blanket page-level empty state (columns are independently empty/non-empty).
- Empty board (zero theses at all): same page-level empty state already used on `/students` ("Aucun étudiant pour l'instant…").
- Search: removed (see "Deviations from Banani").
- Touch targets ≥48px on cards (card padding already clears this in Banani's spec).

## Deviations from Banani
- **Filter bar removed (2026-08-08, user request)**: Banani's "Filtrer…" search box in the header was dropped entirely — `DashboardHeader`'s `search` prop is no longer passed on this page. Column filtering logic (`filtered`/search state) removed along with it; columns now group directly from the unfiltered `items` list.

## Copy / i18n
All French, sourced directly from the Banani fetch — no new strings invented (column labels, "Filtrer…", "Ajouter un étudiant").

## Implementation checklist
- [ ] `KanbanCard` component
- [ ] `/students/kanban/page.tsx` — ENCADRANT-gated, fetches `/api/theses?limit=50`, groups by stage
- [ ] "Kanban" button on `/dashboard`
- [ ] "Kanban" button on `/students` (via `DashboardHeader`'s `actions` slot)
- [ ] Real search wiring
- [ ] `AddStudentForm` reuse on every add affordance
- [ ] 375/768/1280 check — horizontal scroll container verified at all three
- [ ] `pnpm format && lint && typecheck && test && build`

## Open questions for user
None — fully resolved from existing code + the Banani source. See the companion `admin-dashboard.md` for the one open question blocking that screen.
