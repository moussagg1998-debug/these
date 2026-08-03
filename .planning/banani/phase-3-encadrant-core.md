# Phase 3 — Encadrant core screens — Banani → Next.js

## Source
- Banani flow: ThèseFacile (`YQWElzV_9JrI`).
- Screens: `DashboardEncadrant.jsx` (Dashboard Encadrant), `StudentList.jsx` (Mes étudiants — Liste), `StudentAdded.jsx` (Étudiant ajouté — Dashboard, a *state* of the dashboard, not a distinct route), `StudentDetail.jsx` (Détail Étudiant — Profil). Modal source: `AddStudentForm.jsx` (Ajouter un étudiant).
- Shared components consumed: `Sidebar.jsx`, `StatCard.jsx`, `StudentRow.jsx`, `ActivityItem.jsx`, `FilterBar.jsx`, `StudentProfileSidebar.jsx`, `SuccessMessage.jsx`.

## Routing decision — "Étudiant ajouté" is not a page
Banani modeled `StudentAdded.jsx` as a full second copy of the dashboard screen with one extra student in the mock array plus a `SuccessMessage` overlay. That's how Banani represents "the dashboard, after you just added someone" — it is not a distinct route. This codebase already ships a real toast system (`ToastProvider`/`useToast()`, `src/contexts/ToastContext.tsx`) that does exactly what `SuccessMessage.jsx` mocks by hand. So: no `/students/added` route. The "Ajouter un étudiant" modal, on success, closes and calls `toast(...)` on whichever page hosted it (Dashboard or Students List), and the list re-fetches. This is a REUSE, not a new component — building a bespoke `SuccessMessage` component would duplicate `ToastProvider` for no reason.

## Backend gap found + resolution: `AddStudentForm` fields vs. `POST /api/theses`
Banani's modal collects five fields: **Nom complet, Adresse e-mail, Titre de la thèse/mémoire, Étape actuelle** (select, default "Rédaction"), **Échéance estimée** (date). Phase 1's `POST /api/theses` only accepted `{ studentEmail, topic }`, because the MVP simplification is "the student must already have a registered account" (no invite-by-email flow yet — documented in `IMPLEMENTATION-PLAN.md`).

Resolved by extending the route (not deferring to a later phase, since the modal can't work correctly without it):
- `stage` and `deadlineAt` are now optional body fields (`frontend/src/app/api/theses/route.ts`). `stage` must be one of the 5 values already used by `Thesis.stage` (`En attente | Rédaction | Révision | Bloqué | Soutenance` — see schema comment). `deadlineAt`, if present, nests a `Deadline` create (`title: "Échéance initiale"`, `urgency: "medium"`) inside the same `thesis.create` call — atomic via Prisma's nested write, no manual transaction needed.
- **"Nom complet" is intentionally NOT sent to the backend.** The student's display name always comes from their own account (set at their own signup), not from what the encadrant types. Wiring it to the backend would let an encadrant's typo overwrite/shadow a real user's name, and there's no such field in the request contract to abuse. The modal keeps the input (parity with Banani, and it doubles as a "confirm you know who you're adding" step for the encadrant) but its value is local-only. After a successful POST, the success toast uses the *real* name from the server response (`thesis.student.name`), falling back to the typed name only if the account has never set one.
- `POST /api/theses` now also returns `student: { id, name, email, avatarUrl }` on the created thesis (previously bare `thesis` row) so the frontend doesn't need a second round-trip to show the right name in the toast / redirect target.

## Backend gap found + resolution: list enrichment for `StudentRow`
`StudentRow.jsx` needs `lastSubmission`, `pendingComments`, `deadline`, `urgency` — none of which exist as columns on `Thesis`; they're derived from related rows. `Comment` also has no resolved/unresolved concept in the schema (see `schema.prisma`), so Banani's "pendingComments" (implying a resolved state) can't be reproduced exactly.

`GET /api/theses` now includes, per thesis:
- `documents` — latest one only (`orderBy: uploadedAt desc, take: 1`) → drives "Dernière soumission".
- `deadlines` — nearest upcoming one only (`where: dueAt >= now, orderBy: dueAt asc, take: 1`) → drives the "Échéance" column and its urgency dot.
- `_count.comments` — **simplified from Banani's "pending" semantics to a plain total comment count** for this MVP. Flagged here rather than silently reinterpreted — Phase 4 (Commentaires) is where a real resolved/unresolved model would be introduced if wanted.

Urgency for the deadline dot is derived client-side from days-until-due (`< 3d → high`, `< 14d → medium`, else `low`) — no `urgency` is stored redundantly on Thesis; `Deadline.urgency` (set by the encadrant when creating a deadline) is a separate, independent signal already used by `/deadlines`.

`GET /api/profile` now also returns `name`/`email` (previously `profileType`/`institutionId` only) — needed for the Sidebar's "Pr. {name}" footer and has no reason to live anywhere else (this route is already the "my ThèseFacile profile" endpoint; `/api/auth/me`, which is on the protected list's neighborring surface, stays auth-only).

## Component breakdown
- **NEW** `src/components/dashboard/Sidebar.tsx` — left nav (`Tableau de bord`/`Mes étudiants`/`Documents`/`Commentaires`/`Échéances`/`Paramètres`), highlights `active` route via `usePathname()`. Documents/Commentaires/Échéances/Paramètres links point at routes that don't exist until Phases 4/5/7 — rendered as real `<Link>`s (not disabled) since 404 during active development is more honest than a fake disabled state; each Phase adds its own route under the existing nav.
- **NEW** `src/components/dashboard/StatCard.tsx`, `StudentRow.tsx`, `ActivityItem.tsx`, `FilterBar.tsx`, `StudentProfileSidebar.tsx` — direct ports of the Banani source, wired to real props instead of the hardcoded mock arrays.
- **NEW** `src/components/dashboard/AddStudentForm.tsx` — modal, real controlled inputs + `POST /api/theses`, error mapping for `STUDENT_NOT_FOUND` / `NOT_A_STUDENT` / `THESIS_ALREADY_EXISTS`.
- **REUSE** `Icon`, `Avatar` (Phase 2) — `Avatar` replaces Banani's `@global/UserAvatar` illustration service exactly as decided in Phase 2.
- **REUSE** `ToastProvider`/`useToast()` — replaces `SuccessMessage.jsx` (see routing decision above).
- **REUSE** `useApi()` (`src/lib/useApi.ts`) — stale-while-revalidate GET wrapper already used elsewhere; fits `/api/theses` and `/api/theses/[id]` without a new data-fetching pattern.

## Screens

### Dashboard Encadrant → `/dashboard` (frontend/src/app/dashboard/page.tsx)
Client component, `useUser()` auth-gated. Fetches `/api/theses` (own list) via `useApi`. KPIs (`StatCard` × 4) computed from the fetched list client-side: total count, count with a comment awaiting reply (`_count.comments > 0` as the MVP proxy), documents submitted this month (best-effort — needs per-document dates; computed from `documents` we already fetched per-thesis... only the latest one is available, so "submissions this month" becomes "students with a submission this month", a documented approximation), count with an overdue/urgent deadline. Table = `StudentRow` × N (capped, "Voir tout" → `/students` for the rest — Banani's own copy says "12 étudiants" in the header while listing 7 rows, i.e. it was never meant to be exhaustive either). Right rail: `ActivityItem` feed built from the same per-thesis latest-document data (real "Activité récente" replaces Banani's separate unmodeled `activities` mock array — no `Activity` table exists nor is warranted for an MVP). "Ajouter un étudiant" opens `AddStudentForm`.

### Mes étudiants — Liste → `/students` (frontend/src/app/students/page.tsx)
Client component. Same data source as the dashboard (`/api/theses`), plus `FilterBar` wired to real `stage` filtering (client-side filter over the fetched page — MVP, no server-side stage filter param needed at this data volume). "Ajouter un étudiant" here too (same modal component, reused).

### Ajouter un étudiant (modal, mounted from both `/dashboard` and `/students`)
See backend section above for the field contract. Client-side validation only for "Nom complet" (non-empty) since it's not transmitted; the rest mirrors the Zod contract (email format, topic 1-500 chars, stage enum, optional date).

### Détail Étudiant — Profil → `/students/[id]` (frontend/src/app/students/[id]/page.tsx)
Client component. Fetches thesis via `/api/theses/[id]`, and both `/api/theses/[id]/documents` + `/api/theses/[id]/comments` to build the "Activité récente" timeline (merged, sorted by date, capped to 5) — reuses existing Phase 1 endpoints instead of adding new aggregation server-side. Only the "Aperçu" tab is built this phase (Documents/Commentaires/Historique tabs are Phase 4 — rendered as inert tab labels, not fake-clickable, since their content doesn't exist yet). `StudentProfileSidebar` "Envoyer un retour" action is a stub that scrolls/focuses a comment box placeholder for now — full commenting UI is Phase 4; not wiring a half-built comment form here per the no-half-finished-features rule.

## Responsive plan
Banani only shipped desktop (`screenSize: 'desktop'`) for all four screens, same as Phase 2.
- **Base (375px)**: `Sidebar` collapses to a bottom tab bar or a slide-in drawer behind a hamburger in a mobile top bar (a fixed 224px-wide sidebar cannot coexist with a 375px viewport) — implemented as: sidebar hidden below `lg:`, a mobile top bar with a hamburger opens it as an overlay drawer. KPI grid → 1 column (`grid-cols-1`), stacks to 2 at `sm:`, 4 at `lg:`. Student table → the fixed-width flex columns from Banani (`w-72`, `w-28`, etc.) don't survive 375px; below `lg:` each `StudentRow` becomes a stacked card (name/topic on top, stage+progress+deadline as a compact meta line) instead of a horizontal row — the column-header bar is hidden below `lg:` accordingly. Détail Étudiant's right sidebar (`StudentProfileSidebar`, `w-80`) moves below the main content, full width, below `lg:`.
- **md (768px)**: KPI grid 2-column; student cards still stacked (table needs the full `lg` width to make sense with 6 columns).
- **lg (1024px+)**: Banani's fetched desktop layout — persistent sidebar, table rows, side-by-side detail + profile sidebar.
- **xl (1280px+)**: as fetched, no further changes needed (Banani's own max content width already fits).

## Implementation checklist
- [x] Backend: `stage`/`deadlineAt` on `POST /api/theses`, list enrichment (`documents`/`deadlines`/`_count.comments`) on `GET /api/theses`, `name`/`email` on `GET /api/profile` — with tests.
- [ ] `Sidebar`, `StatCard`, `StudentRow`, `ActivityItem`, `FilterBar`, `StudentProfileSidebar`, `AddStudentForm`
- [ ] `/dashboard` Dashboard Encadrant
- [ ] `/students` Mes étudiants — Liste
- [ ] `/students/[id]` Détail Étudiant — Profil
- [ ] Rewire post-login / post-profile-choice redirect target from `/` to `/dashboard` for `ENCADRANT`
- [ ] 375 / 768 / 1280 check (`pnpm dev`, resize) — same caveat as Phase 2: no browser tool available in this session, must be human-verified
- [ ] `pnpm format && lint && typecheck && test && build`

## Deliberate simplifications (flagged, not silent)
- "Pending comments" = total comment count, not resolved/unresolved (schema has no such field yet).
- "Submissions this month" KPI approximates via latest-document-per-thesis, not a real submissions-this-month count (would need per-document date aggregation across all documents, not just the latest).
- Dashboard's "Activité récente" and "Prochaines échéances" panels are real-data-driven, replacing Banani's separate unmodeled mock arrays — no new `Activity` table introduced.
- Détail Étudiant's Documents/Commentaires/Historique tabs and "Envoyer un retour" action are inert this phase (Phase 4 territory) — not stubbed with fake interactivity.
