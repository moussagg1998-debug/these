# Phase 6 — Paramètres & Préférences (Encadrant) — Banani → Next.js

## Source
- Banani screen: `SettingsPage.jsx` ("Paramètres — Compte & Préférences"), `screenSize: desktop`.
- Shared component: `SettingSection.jsx` (collapsible section + item list: toggle/select/text/button rows).
- Not in scope: `screenId` line 70's "Paramètres Utilisateur" is the **student**-side settings screen (different Sidebar, different item set) — that ships with the Étudiant phase, not here.

## Routing decision — reuse `/settings`, don't add a new route
`Sidebar.tsx`'s `NAV_ITEMS` already points "Paramètres" at `/settings` (added in Phase 3, dormant since). That route currently serves a **generic, un-styled** starter-kit page (bare Tailwind, no `DashboardShell`) with two real flows: password change/set (`/api/auth/change-password`, `/api/auth/set-password`) and Google account linking (`/api/auth/oauth/google/start`). Neither of those routes/flows is Banani-sourced or profile-gated — they predate this port and serve **any** authenticated user regardless of `profileType`.

Decision: branch `/settings/page.tsx` on `profile.profileType`:
- `ENCADRANT` → new Banani-styled `EncadrantSettingsContent` (this phase).
- anything else (`ETUDIANT`, `null`, still loading) → **existing generic content, byte-for-byte unchanged**.

Rationale: Banani ships a *separate* screen for student settings that doesn't exist yet. Gating the whole route to ENCADRANT and redirecting everyone else (the pattern used by `/documents`, `/comments`, `/deadlines`) would regress real, working functionality for ETUDIANT accounts (they can already change their password today) for a screen that isn't built. Minimal-blast-radius wins over route purity here.

## Field-scope gaps found + resolution
Banani's mock has 6 sections; only some map to real backend capability. Per-item disposition:

**Profile header** (name / email / institution / "membre depuis") — **real**, no gap. `name`+`email` from `GET /api/profile` (already returned); `institution.name` is a **new field** added to that route's response (was `institutionId` only — the id alone isn't renderable); "Membre depuis" uses `user.createdAt` already returned by `/api/auth/me` (`useUser()`), no backend change needed there.

**"Général"** (Langue / Fuseau horaire / Format de date) — **no backing at all**: the app is French-only, no i18n infra, no per-user timezone/date-format consumer anywhere. Rendered as `select` items, **disabled**, "Bientôt disponible" tooltip — same treatment as Phase 5's reminder checkbox. Not deleted (Banani shows it, hiding it would look like a bug), not faked as functional.

**"Notifications"** — 3 of 4 items map to real, already-firing notification types (confirmed by reading each route's `createNotification` call):
- "Nouvelles soumissions" → `DOCUMENT_SUBMITTED`, notifies the **encadrant** (`theses/[id]/documents/route.ts`) — real, wired to `.inApp` channel.
- "Réponses aux commentaires" → `COMMENT_ADDED`, notifies whichever party didn't write the comment, i.e. the encadrant when the student comments (`theses/[id]/comments/route.ts`) — real, wired to `.inApp`. Slightly broader than "replies only" (fires for top-level comments too), close enough to the label to be honest; noted here rather than silently assumed.
- "Rappels d'échéances" (3 jours avant) → **no scheduler exists** (confirmed in Phase 5's plan already) — inert, disabled, tooltip.
- "Notifications par email" → a single blanket toggle in Banani vs. our per-event `{email, inApp}` model. Wired as a **fan-out**: flipping it PATCHes `email` on both `DOCUMENT_SUBMITTED` and `COMMENT_ADDED` at once. Its own displayed state reads `DOCUMENT_SUBMITTED.email` as the representative value (documented assumption: if the two ever diverge via direct API use, this toggle just re-syncs them next click).
- **Caveat surfaced, not hidden**: `isChannelEnabled()` (the read-side helper in `notifications/prefs-merge.ts`) is not yet consulted anywhere in `createNotification` or the outbox/email dispatcher — flipping these toggles genuinely persists a preference via the existing tested `/api/notifications/prefs` API, but nothing currently *enforces* it end-to-end. This is a pre-existing gap in the starter's notification pipeline (present before this phase), not something this UI pass introduces or should silently paper over. Flagged here and to the user.

**"Confidentialité & Sécurité"** — "Mot de passe" is real (ported from the generic page into a modal, see below). "Authentification à deux facteurs" and "Sessions actives" have zero backend (no TOTP fields on `User`, no session table — JWT is stateless) — inert, disabled, tooltip. **Addition beyond Banani**: a 4th item, "Compte Google", added to this section (not in the Banani mock) so the real, working Google-linking flow isn't dropped — renders as `text: 'Lié'` when linked, `button: 'Lier'` (→ `/api/auth/oauth/google/start?next=/settings`) otherwise.

**"Données & Intégrations"** (collapsed by default, matches Banani) — all 3 items (export, Google Drive sync, Dropbox) have no backend anywhere in the codebase — entirely inert, disabled, tooltip. Kept collapsed and fully inert rather than removed, so the section list still matches the design 1:1.

**"Compte"** (collapsed by default) — "Email principal" is real (`user.email`, read-only `text` type — Banani renders it as plain text too, no edit affordance exists in the mock). "Supprimer le compte" has no route (account deletion is a real, irreversible, out-of-scope feature) — inert, disabled, tooltip.

**Footer "Annuler" / "Enregistrer les modifications"** — **dropped**. Every real control on this screen saves immediately on interaction (a toggle flip is an instant `PATCH`; the password change lives in its own modal with its own submit). A page-level Save button implies batched draft state that doesn't exist here — keeping it would be the one genuinely dishonest affordance on the screen, worse than the already-flagged inert items (which are honest about being inert). Cut it.

**Toggle visual state** — Banani's own `SettingSection.jsx` renders every toggle as the exact same static gray pill (`bg-muted`, no on/off variant — literally a mockup placeholder, not a real switch). Since these are wired to real state here, a real on/off visual (filled `bg-primary` + knob translate when checked) was designed for this port; not a Banani→code gap, just Banani's static-mockup limitation.

**Section collapse** — Banani hardcodes `open` per section via a prop with no interactivity (chevron icon is static). Built as **real** expand/collapse state (cheap, matches the chevron affordance the design already implies), initialized from Banani's per-section `open` values (`Général`/`Notifications`/`Confidentialité` start open; `Données & Intégrations`/`Compte` start collapsed).

## Backend
- `GET /api/profile` — extend response with `institution: { id, name } | null` (was `institutionId` only). Additive field; existing consumers (`/documents`, `/comments`, `/deadlines` pages) destructure only the fields they use and are unaffected. Update `route.test.ts`'s exact-match assertions accordingly.
- No new routes. Reuses (unmodified): `PATCH /api/notifications/prefs`, `PUT /api/auth/change-password`, `POST /api/auth/set-password`, `GET /api/auth/oauth/google/start` (all pre-existing, none of them protected files — the protected list covers `oauth/google.ts` and its route handlers as a *guard-logic* concern, not calling them from a new UI).

## Component breakdown
- **NEW** `src/components/dashboard/SettingSection.tsx` — port of Banani's `SettingSection.jsx`, made real: real toggle switch (on/off visual + `role="switch"`), real expand/collapse, `select`/`text` items stay presentational (select is always disabled in this phase — nothing here needs a real dropdown), `button` items take an `onAction`.
- **NEW** `src/components/dashboard/PasswordSettingsModal.tsx` — the password change/set form, extracted from the current generic `/settings` page (same `hasPassword` branch, same two endpoints) into the modal shell shared by `AddStudentForm`/`AddDeadlineForm` (`fixed inset-0 bg-black/40` + `w-96` card).
- **REUSE** `DashboardShell`, `Sidebar` (already has the `/settings` nav entry), `Avatar` (sized up for the profile-header hero — see below), `Icon`, `useToast`, `useApi`.
- `Icon.tsx` needs one addition: `chevron-up` (lucide `ChevronUp`) for the open-section state — every other icon used here (`sliders`, `bell`, `lock`, `database`, `user`, `chevron-down`, `settings`) already exists.

## Profile header — one deviation from Banani
Banani's hero is a 96×96 gradient **square** (`rounded-lg`) with a generic user glyph, not the person's initials. This project's `Avatar` component (established Phase 2) always renders initials in a **circle** (`rounded-full` is hardcoded in the component) — deliberately not one-off-styled per screen, to keep "how a person is represented" consistent app-wide. Reusing `Avatar` at `h-24 w-24` here rather than inventing a square gradient variant for a single screen.

## Screens

### Paramètres — Compte & Préférences → `/settings` (frontend/src/app/settings/page.tsx)
Client component. Top-level branch: `!user || profileLoading` → `Chargement…` (new gate — the route didn't fetch a profile before; negligible flash, consistent with every other page). Then `profile?.profileType === 'ENCADRANT'` → `EncadrantSettingsContent`; otherwise render the pre-existing generic markup completely unchanged (extracted as-is into the same file, no logic touched).

`EncadrantSettingsContent`: `DashboardShell` + top bar ("Compte" / "Paramètres & Préférences") → profile-header hero → 5 `SettingSection`s in Banani's order → no footer buttons (see above). Notification toggles read initial state from `GET /api/notifications/prefs`, apply an optimistic local override on click (same `overrides` map pattern as Phase 4's Comments Overview resolve-toggle) with a PATCH fired async and a toast + revert on failure.

## Responsive plan
`screenSize: desktop` in Banani, ported mobile-first per the skill's mandatory rule:
- **Base (375px)**: profile header stacks (`flex-col` → `sm:flex-row`), badges wrap (`flex-wrap`). Section item rows already stack acceptably at 375px (label block + control), control-side items (`select`/`button`) get `shrink-0`. `DashboardShell`'s existing mobile drawer nav is reused unchanged.
- **lg (1024px+)**: Banani's fetched desktop layout (`flex-row` profile header, fixed-width control column per item).

## Deliberate simplifications (flagged, not silent)
- `Général` section, 2FA, active sessions, data export, Drive/Dropbox integrations, account deletion: all fully inert (disabled + tooltip) — zero backend exists for any of them.
- Notification toggles persist real preference values via the existing tested API, but nothing in the notification-creation pipeline reads them yet (pre-existing gap, not introduced here).
- "Notifications par email" is a fan-out convenience over two event types, not a true global channel switch.
- Page-level Save/Cancel footer dropped — everything saves on interaction.
- Google-account-linking added as an extra item beyond Banani's mock, to avoid regressing existing real functionality.
- Profile-header avatar is a circle (reused `Avatar`), not Banani's gradient square.

## Implementation checklist
- [x] `Icon.tsx`: add `chevron-up`
- [x] `GET /api/profile`: add `institution: {id, name} | null` + update test
- [x] `SettingSection` component (real toggle/collapse)
- [x] `PasswordSettingsModal` component (ported from generic `/settings`)
- [x] Rewrite `/settings/page.tsx`: branch on `profileType`, keep generic content as the non-ENCADRANT fallback verbatim
- [ ] 375/768/1280 check — **not verified**, same caveat as every prior phase, no browser tool in this session
- [x] `pnpm format && lint && typecheck && test && build`
