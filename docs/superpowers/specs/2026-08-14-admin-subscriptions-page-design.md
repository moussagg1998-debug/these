# Admin — page Abonnements — design spec

**Date:** 2026-08-14
**Status:** Approved by user, pending implementation plan

## Problem

The Chariow subscription integration (merged 2026-08-12) and the subsequent entitlements system (merged 2026-08-14) gave the app a real subscription model: `User.plan` (`"FREE" | "ESSENTIEL"`), `planExpiresAt`, and a Chariow-backed checkout/webhook/reconcile/expire pipeline. But the admin back-office has no visibility into any of it. The dashboard's own footnote (`admin/page.tsx`) still says "aucun modèle d'abonnement n'existe dans le produit aujourd'hui" — written when that was true, now false. The sidebar already carries an `{ icon: 'credit-card', label: 'Abonnements' }` entry, but it renders inert ("Bientôt disponible") because the page behind it was never built.

Goal: build that page — a read-only admin view of who is subscribed, for how long, and an estimate of recurring revenue — using only data that already exists (`User.plan`/`planExpiresAt`, `subscriptions/plans.ts`'s price config), no new data model.

## Non-goals (explicitly out of scope)

- **Manual plan overrides from the admin UI** (grant/extend/revoke a user's Essentiel plan by hand). Confirmed with the user: this page is read-only for this iteration. `CLAUDE.md` currently documents `reconcile.ts`/`expire.ts`/`lock.ts`/`plans.ts` as the only writers of `plan`/`planExpiresAt`; adding a 4th writer (an auditable admin mutation route) is a larger, separate piece of work if ever requested.
- **Actual monthly-collected revenue** (sum of `PAID` order amounts within the calendar month). Confirmed with the user: the revenue KPI is an MRR estimate (active subscribers × plan price), not a ledger of money received. If a "revenue collected" view is wanted later, it is a separate KPI, not a replacement for this one.
- **Institution-level subscription grouping.** The plan is per-`User`, not per-`Institution` — nothing in this feature touches `Institution` or the unrelated `Order.institutionId` field (a distinct, currently-unused generic-starter field for a different, not-yet-built concept).
- **Chariow payment/order history table.** The user chose the "overview + subscriber list" scope over the "payment history" scope. `Order` rows tied to subscriptions remain visible only through the existing generic `/api/admin/orders` route; nothing new is built for them here.

## In scope

1. Two new read-only admin API routes surfacing plan data that already exists on `User`.
2. One new admin page (`/admin/subscriptions`) consuming them, styled and structured like the existing `/admin/users` page.
3. Wiring the sidebar's existing inert "Abonnements" entry to the new page.
4. Correcting the now-stale "no subscription model exists" footnote on the admin dashboard.

## Architecture

### `GET /api/admin/subscriptions/stats`

New file: `frontend/src/app/api/admin/subscriptions/stats/route.ts`. Mirrors `frontend/src/app/api/admin/stats/route.ts` exactly in shape: `requireAdmin('ADMIN')` → `enforceAdminRateLimit(auth.admin.id)` → sequential (not `Promise.all`, per this codebase's Neon `connection_limit=1` convention — see `institutions/route.ts`'s note) `prisma.user.count` calls.

Response:

```ts
{
  essentielActive: number;        // plan='ESSENTIEL' AND (planExpiresAt IS NULL OR planExpiresAt > now)
  essentielExpiredUnswept: number; // plan='ESSENTIEL' AND planExpiresAt <= now
  free: number;                    // plan != 'ESSENTIEL'
  mrrFcfa: number;                 // essentielActive * expectedPriceFcfa('ESSENTIEL')
}
```

`expectedPriceFcfa` is imported from `frontend/src/lib/server/subscriptions/plans.ts` (existing, unmodified) — never hardcodes the 5900 FCFA default, so an operator's `CHARIOW_ESSENTIEL_PRICE_FCFA` override is reflected automatically.

The `essentielActive` / `essentielExpiredUnswept` split reuses the same expiry-aware logic as `effectivePlan()` in `frontend/src/lib/server/subscriptions/entitlements.ts` (existing, unmodified) — `planExpiresAt IS NULL OR planExpiresAt > now()` is "active"; everything else with `plan='ESSENTIEL'` is "stale, not yet swept." This is a Prisma `where` clause, not a call to `effectivePlan()` itself (that function takes one user, not a query filter), but the boundary condition must match it exactly so the KPI and the real entitlement gate never disagree about who counts as subscribed.

### `GET /api/admin/subscriptions`

New file: `frontend/src/app/api/admin/subscriptions/route.ts`. Mirrors `frontend/src/app/api/admin/users/route.ts`'s list shape: `requireAdmin('ADMIN')` → rate limit → cursor pagination (`clampLimit`/`decodeCursor`/`buildPage`, the same shared pagination helper every list route in this codebase uses) → optional `q` search on name/email (same search-clause construction as the users route) → `where: { plan: 'ESSENTIEL' }` (always — this route is exclusively "who is or was recently Essentiel," not a general user list) → `orderBy: [{ planExpiresAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]` — Prisma's `nulls: 'last'` ordering modifier (GA since Prisma 4.16, no preview flag needed; this project is on Prisma 5.22) puts `planExpiresAt: null` rows (lifetime/no-expiry Essentiel accounts) after every row with a real date, so the soonest-expiring real date always sorts first.

Row shape:

```ts
{
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: 'ESSENTIEL';       // always this value, filtered above — included for shape consistency, not because it varies
  planExpiresAt: string | null; // ISO
  createdAt: string;       // ISO
}
```

Both routes only ever `select`/`count` on `plan`/`planExpiresAt` — never write them, consistent with the existing invariant that only `reconcile.ts`/`expire.ts`/`lock.ts`/`plans.ts` write those two fields.

### `/admin/subscriptions` page

New file: `frontend/src/app/admin/subscriptions/page.tsx`, `'use client'`. Structurally mirrors `frontend/src/app/admin/users/page.tsx`:

- `AdminShell` wrapper; gated on `useApi('/api/admin/me')`, redirecting non-admins to `/dashboard` (identical guard to every other admin page).
- KPI row: three `AdminKpiCard`s — **"Essentiel actifs"** (`essentielActive`), **"Gratuit"** (`free`), **"MRR estimé"** (`mrrFcfa`, formatted with the existing `Intl.NumberFormat('fr-FR')` pattern used on the main dashboard, suffixed "FCFA"). Skeleton state (`AdminKpiCardSkeleton`) while `/stats` is loading, matching the dashboard's own loading pattern.
- If `essentielExpiredUnswept > 0`: one small muted line beneath the KPI row — "N abonnement(s) en attente de traitement par la tâche planifiée" — informational only, no button, no separate KPI card (this is a health signal for the admin reading the page, not a headline number).
- Search box: debounced 300ms (identical pattern to `admin/users/page.tsx`), filtering the table via the `q` param.
- Table columns: **Utilisateur** (`Avatar` + name/email, same cell layout as the users table) / **Expire le** (formatted date, or "—" when `planExpiresAt` is null) / **Statut** badge, computed client-side from `planExpiresAt`:
  - `Actif` (green, `bg-success/15 text-success`) — null or in the future, and not within the "bientôt" window below.
  - `Expire bientôt` (amber) — in the future but within 7 days.
  - `Expiré — non traité` (red, `bg-danger/15 text-danger`) — in the past (the `essentielExpiredUnswept` rows surfaced individually).
- Skeleton rows while loading, empty-state message when the search yields nothing (matching `admin/users/page.tsx`'s exact copy pattern, adapted: "Aucun abonné ne correspond à cette recherche.").
- "Charger plus" cursor-pagination button, identical mechanics to the users page (`extraItems`/`extraCursor`/`loadMore`).
- No row actions — read-only per the approved scope.

### Nav wiring

`frontend/src/components/admin/AdminSidebar.tsx`: the existing `{ icon: 'credit-card', label: 'Abonnements' }` entry (line 34) gains `href: '/admin/subscriptions'`, making it a real link rendered the same way as its siblings (active-state highlighting via `pathname === item.href`, same as every other item). No other entries change.

### Dashboard footnote correction

`frontend/src/app/admin/page.tsx`: the paragraph at the bottom of the dashboard currently reads:

> "MRR, statut/plan par établissement et alertes automatiques ne sont pas encore disponibles — aucun modèle d'abonnement n'existe dans le produit aujourd'hui."

Replaced with:

> "Statut/plan par établissement et alertes automatiques d'abonnement ne sont pas encore disponibles — voir la page Abonnements pour le MRR et le détail des abonnés."

This drops the now-false "no subscription model exists" claim, keeps the two still-true claims (no institution-level plan grouping; no automated subscription alerts — both remain explicitly out of scope per this spec), and points the reader at the new page instead of leaving MRR listed as unavailable.

## Error handling

Both new routes follow this codebase's existing admin-route error shape exactly — no new error codes invented:
- Unauthenticated/non-admin → whatever `requireAdmin('ADMIN')` already returns (401/403), unchanged.
- Rate-limited → whatever `enforceAdminRateLimit` already returns, unchanged.
- No plan-specific error cases exist — these are pure reads with no user input beyond `q`/`cursor`/`limit`, all already validated by the shared pagination helpers used elsewhere.

Frontend: on a fetch error, `useApi`'s existing error surfaces exactly as it does on `/admin/users` today (no bespoke handling needed) — this spec doesn't change that hook.

## Testing plan

- `frontend/src/app/api/admin/subscriptions/stats/route.test.ts` (new): admin-auth guard (401/403), rate-limit guard, the active/stale-expired/free counting split (including the boundary — `planExpiresAt` exactly `now` and both directions around it), `mrrFcfa` arithmetic including a `CHARIOW_ESSENTIEL_PRICE_FCFA` override case.
- `frontend/src/app/api/admin/subscriptions/route.test.ts` (new): admin-auth guard, rate-limit guard, `plan: 'ESSENTIEL'` filter is always applied, `q` search matches the users route's search behavior, cursor pagination, `planExpiresAt` ascending order with nulls last.
- No new `.test.tsx` — this repo has no component test infrastructure (`vitest.config.ts` is `src/**/*.test.ts` only, node environment; documented precedent in the 2026-08-12 entitlements plan). The new page and the sidebar link are verified manually against `pnpm dev`: as SUPERADMIN, confirm "Abonnements" is a real (non-inert) link, the KPI row renders real numbers, the subscriber table lists Essentiel users sorted soonest-expiring-first with correct status badges, search filters correctly, and "Charger plus" paginates. Also confirm the dashboard footnote no longer claims no subscription model exists.

## Files touched

**New:**
- `frontend/src/app/api/admin/subscriptions/stats/route.ts`
- `frontend/src/app/api/admin/subscriptions/stats/route.test.ts`
- `frontend/src/app/api/admin/subscriptions/route.ts`
- `frontend/src/app/api/admin/subscriptions/route.test.ts`
- `frontend/src/app/admin/subscriptions/page.tsx`

**Modified:**
- `frontend/src/components/admin/AdminSidebar.tsx` — add `href` to the existing "Abonnements" entry
- `frontend/src/app/admin/page.tsx` — correct the stale footnote

**Not touched:** `User.plan`/`planExpiresAt` writers (`reconcile.ts`, `expire.ts`, `lock.ts`, `plans.ts` — read from, never modified), `entitlements.ts`/`require-feature.ts` (read pattern referenced, not modified), `Order`/`Institution` models, `/api/admin/orders` (unchanged), any protected file per `CLAUDE.md`.
