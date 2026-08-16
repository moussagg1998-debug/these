# Admin — Tableau de bord — Banani → Next.js

## Source
- Banani screen: `new_screen9.jsx`, `displayName: 'Admin — Tableau de bord'`, `screenSize: desktop`.
- Own sidebar (dark, `bg-foreground`), independent from the Encadrant `Sidebar` — 8 nav items (Tableau de bord / Universités / Encadrants / Étudiants / Abonnements / Analytiques / Alertes / Configuration), only the first has content in this fetch.

## Routing decision — new top-level `/admin`, gated by the existing `role` field
No live `/admin` UI exists anywhere in this fork today — `examples/frontend-pages/admin/*` are unused reference-only pages (per README), and only the generic `/api/admin/*` **routes** (inherited from the starter, not ThèseFacile-specific) exist. `profileType` (ENCADRANT/ETUDIANT) is unrelated to this screen — access is gated by the pre-existing `User.role` field (USER/ADMIN/SUPERADMIN), the same one `requireAdmin()` already checks server-side. No new auth concept needed; only a client-side gate (`GET /api/admin/me`, mirroring how `/settings`/`/dashboard` already gate on `GET /api/profile`) plus the route handlers themselves already enforcing `requireAdmin`.

## System findings — this screen needs real data that doesn't exist yet
Unlike the Kanban screen, this one cannot be built as pure UI-over-existing-data. Auditing each element against the actual schema:

| Banani element | Backing data today |
|---|---|
| KPI "Encadrants inscrits" | ✅ Real — `count(User where profileType=ENCADRANT)` |
| KPI "Étudiants suivis" | ✅ Real — `count(User where profileType=ETUDIANT)` (or distinct students on `Thesis`) |
| KPI "Thèses en cours" | ✅ Real — `count(Thesis where archivedAt=null)` |
| KPI "Universités actives" | ❌ No active/inactive concept on `Institution` (only `id`, `name`, `createdAt`) |
| KPI "MRR (FCFA)" | ❌ No subscription/plan model anywhere — `Order` is one-shot payments only, no recurring billing concept exists in the codebase today |
| KPI "Comptes inactifs" | ❌ No `lastLoginAt`/`lastSeenAt` field tracked on `User` anywhere |
| Table "Universités" — nom, encadrants, étudiants | ✅ Real (needs a new aggregation query, groupBy `institutionId`) |
| Table "Universités" — pays, plan, statut | ❌ No `country`, no `plan`, no `status` field on `Institution` |
| "Alertes système" (paiement échoué, essai qui se termine…) | ❌ No alerting system exists — no trial concept, no payment-failure event surfaced anywhere |
| "Nouveaux inscrits" (users + université + date) | ✅ Real — recent `User` rows joined to `Institution.name`, needs a small new aggregate or extending `GET /api/admin/users` |
| Sidebar items beyond "Tableau de bord" (Universités/Encadrants/Étudiants/Abonnements/Analytiques/Alertes/Configuration) | ❌ Only this one screen was fetched — the other 7 have no designed content to translate |

This mirrors exactly the kind of gap already flagged and resolved honestly elsewhere in this project (Phase 10's "no fake plan tier invented", Phase 7's dropped 8-step milestone curriculum) — the difference here is the gap is large enough (a whole subscription/plan/alerting layer) that it changes what "integrate this screen" can honestly mean in one pass.

## Proposed scope — Option A (recommended): honest MVP, ship what's real, flag the rest
- Build the "Tableau de bord" screen's visual chrome exactly as designed (dark admin sidebar, KPI grid, Universités table, right column).
- KPI grid: show only the 3 real metrics (Encadrants inscrits, Étudiants suivis, Thèses en cours). Drop "Universités actives", "MRR", "Comptes inactifs" from the grid rather than fabricate them — same "dropped, not invented" precedent as every prior phase.
- Universités table: real name + real encadrant/student counts (new `GET /api/admin/institutions` aggregate). Drop the pays/plan/statut columns.
- "Alertes système": real empty state ("Aucune alerte pour l'instant") — no alerting system exists to populate it honestly.
- "Nouveaux inscrits": real recent signups (extend `GET /api/admin/users` or add a small dedicated query), with role label (Encadrant/Étudiant from `profileType`) and institution name.
- Sidebar: only "Tableau de bord" is a real link. The other 7 items render **visibly but inert** (`title="Bientôt disponible"`, `cursor-not-allowed`) — the same established pattern used throughout the app (`StudentMessagingContent`'s phone/info buttons, `StudentNav`'s early inert links) — rather than either fabricating 7 screens or silently deleting them from the design.
- Access: `role IN (ADMIN, SUPERADMIN)`, same as the existing `/api/admin/*` routes already enforce.

## Alternative — Option B: build the missing layer first
If there's a real product intention behind MRR/plans/trial/alerts (e.g. this is meant to back the subscription model from the recent monetization strategy note), that's materially more work — a `plan`/`status`/`country` on `Institution`, a subscription/billing-cycle model, and an alerting mechanism — and changes the order of operations (build the data model, then this screen becomes trivial). Worth 30 seconds to confirm before choosing Option A by default.

## Component breakdown (Option A)
- **NEW** `src/app/admin/layout.tsx` — gates on `role`, redirects non-admins to `/dashboard`.
- **NEW** `src/app/admin/page.tsx` — the dashboard screen.
- **NEW** `src/components/admin/AdminSidebar.tsx` — dark sidebar, 8 items, 1 real + 7 inert.
- **NEW** `src/components/admin/AdminKpiCard.tsx`, `InstitutionsTable.tsx`, `RecentSignups.tsx`.
- **NEW backend** `GET /api/admin/institutions` (name + encadrant/student counts, `requireAdmin`), extend `GET /api/admin/users` (or add `GET /api/admin/recent-signups`) to include institution name + profileType-derived role label.
- **REUSE** `Icon`, `Avatar`.

## Responsive plan
`screenSize: desktop`. This is an internal back-office screen (SUPERADMIN/ADMIN only) — still built mobile-first per the skill's iron rule: KPI grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (3 real cards, not Banani's 6), Universités table + right column stack (`flex-col lg:flex-row`) below `lg:`, admin sidebar becomes a mobile drawer matching the Encadrant `Sidebar`'s existing `hidden lg:flex` + drawer precedent (`StudentNav`'s drawer implementation is the closest existing pattern to copy).

## Open questions for user
- **Option A vs B** — ship the honest MVP now (3 real KPIs, real institution counts, inert nav for unbuilt sections), or is there a subscription/plan/alerting build already planned that should land first? Recommendation: **Option A** — matches every prior phase's approach in this project, and doesn't block on designing a billing system that wasn't asked for.
