# Phase 2 — Auth & onboarding — Banani → Next.js

## Source
- Banani flow: ThèseFacile (`YQWElzV_9JrI`), fetched 2026-08-03 (same fetch as Phase 1 planning).
- Screens: `new_screen3.jsx` (Landing Page), `new_screen2.jsx` (Connexion), `new_screen6.jsx` (Choix du profil), `new_screen4.jsx` (Conditions d'utilisation).
- Glue pages **not sourced from Banani** (no signup/verify-email screen was designed in the fetched flow): Signup, Verify-email — adapted from the shipped `examples/frontend-pages/{signup,verify-email}.tsx` reference pages, retthemed with the ThèseFacile tokens. Flagged as a gap — a dedicated Banani design for these two would be a good follow-up.

## Navigation flow decision (resolved, not explicitly specced by Banani)
Banani's "Choix du profil" screen shows "Déjà inscrit ? Se connecter" in its nav, which reads as pre-auth chrome reused from the other auth screens rather than a deliberate design choice. The backend requires an authenticated session to set `profileType` (`PATCH /api/profile`), so the flow is:

```
Landing (/) → Créer un compte (/signup) → check-inbox → Verify-email (/verify-email)
  → cookies issued → Choix du profil (/onboarding/profile) → PATCH profileType
  → interim redirect to / (no real dashboards until Phase 3)
Landing (/) → Se connecter (/login) → login → profileType null? → /onboarding/profile
                                              → profileType set? → / (interim)
```
Flag this for veto — if a different flow is wanted (e.g. role chosen before signup), tell me and I'll rewire before Phase 3 dashboards land on top of it.

## Design tokens
Already wired in Phase 1 (`frontend/src/app/globals.css` `@theme`) — no changes needed here. Banani's own JSX already uses Tailwind utility classes (not custom CSS), so translation is close to 1:1 — no token-mapping table needed for this phase.

## Component breakdown
- **NEW** `src/components/ui/Icon.tsx` — maps Banani's `<Icon i="name" size={n} className="..." />` convention to `lucide-react`. Named imports only (icons actually used across this phase — not a full-bundle map).
- **NEW** `src/components/ui/Avatar.tsx` — replaces Banani's `@global/UserAvatar` (a photo-illustration service we don't have). Renders initials in a colored circle instead. Honest downgrade, flagged here rather than silently faked.
- **NEW** `src/components/marketing/MarketingNav.tsx` + `MarketingFooter.tsx` — shared between Landing Page and Terms (both use the identical nav/footer chrome in Banani's source — rule-of-three-is-a-floor, this pattern already repeats twice).
- **REUSE** `useAuth()` / `api()` / `storeCsrfToken()` from the existing auth wiring (`login.tsx`/`signup.tsx`/`verify-email.tsx` examples give the exact call shape).

## Screens

### Landing Page → `/` (frontend/src/app/page.tsx)
Public, server component except the nav (static, no client state needed — no mobile menu interactivity in the Banani source, so a plain server component works, with a `sm:hidden` hamburger added for mobile since Banani only shipped desktop).
Sections: nav, hero (+ mock dashboard illustration), 6 features grid, 3 testimonials, 3 pricing tiers (Essentiel 5 900 FCFA / Pro 12 500 FCFA / Département sur devis — matches the confirmed institution-subscription decision, refined: billing is per-encadrant with a "Département" tier for multi-encadrant teams, not purely per-institution flat fee. Note for Phase 8 billing work), final CTA, footer.

### Connexion → `/login` (frontend/src/app/login/page.tsx)
Client component. Split panel (branding left / form right on desktop; stacks to single column on mobile). Wired to real `POST /api/auth/login` (mirrors `examples/frontend-pages/login.tsx`). "Mot de passe oublié ?" links to `/forgot-password` (not built this phase — pre-existing gap, not new). "Créer un compte" → `/signup`. "Continuer avec Google" → `/api/auth/oauth/google/start?next=/onboarding/profile`.
Post-login redirect: fetch `/api/profile`; `profileType === null` → `/onboarding/profile`, else → `/`.

### Choix du profil → `/onboarding/profile` (frontend/src/app/onboarding/profile/page.tsx)
Client component, auth-required (redirects to `/login` if logged out — mirrors `useUser()` pattern). Two selectable cards (Professeur/Étudiant); on submit, `PATCH /api/profile`. On `409 PROFILE_ALREADY_SET` (user revisits after already choosing), redirect straight through to `/`. Footer copy adjusted from Banani's "vous pourrez changer de rôle ultérieurement" (not true today — `/api/profile` is one-shot per the confirmed product decision) to "contactez le support pour changer de rôle" — the honest version of the same reassurance. Flagging this copy edit explicitly since it deviates from the fetched source text.

### Conditions d'utilisation → `/terms` (frontend/src/app/terms/page.tsx)
Public, server component (fully static — 10 sections + table of contents, no interactivity beyond anchor links). "Version PDF — Télécharger" button has no PDF to link to yet — rendered disabled/inert with a note, not wired to a fake download.

### Glue: Inscription → `/signup`, Vérification email → `/verify-email`
Adapted from the shipped examples, retextured with tokens (`bg-background`, `text-foreground`, `bg-primary`, `border-border`, `rounded-sm`, `font-headings`) instead of the generic gray/black placeholder styling, French copy, IBM Plex Sans. Same wiring (`POST /api/auth/signup`, `POST /api/auth/verify-email`), redirect targets updated to fit the flow above.

## Responsive plan (mandatory — Banani only shipped desktop)
- **Base (375px)**: Landing — sections stack to 1 column, hero illustration moves below copy, pricing cards stack vertically, nav collapses to logo + hamburger (links in a slide-down panel). Connexion — branding panel collapses above the form (or is hidden below `sm:`, form takes full width) since a 40%-width side panel doesn't fit 375px. Choix du profil — cards stack vertically, full width. Terms — sidebar TOC moves above the content (or becomes a collapsible summary), sections remain full width.
- **sm (640px+)**: pricing 2-up if space allows; otherwise stays 1-column until md.
- **md (768px+)**: Landing features/testimonials/pricing grids go to 2 columns; Connexion may reintroduce the branding panel stacked above rather than beside.
- **lg (1024px+)**: Banani's desktop layout as fetched — 3-column grids, side-by-side Connexion panels, Terms sidebar+content two-column.
- **xl (1280px+)**: max-width containers + wider `px-16` paddings as in the source.

## Interactions / state
- Forms: disabled submit button + inline error paragraph while `submitting`, mirroring the existing examples exactly (already accessible pattern: `role="alert"` on errors).
- Touch targets: buttons/cards ≥48px tall on mobile (Banani's `py-3`/`py-3.5` already clears this at the base font scale).
- Choix du profil cards: `role="radio"`/`aria-checked`, keyboard-selectable (Enter/Space), not just click — Banani's mockup only shows mouse affordances.

## Copy / i18n
All copy is already French in the Banani source (no translation layer needed — this product has no i18n toggle). No `constants.ts` extraction — copy lives inline in each page/component like the rest of this codebase's untranslated pages (`/settings`, `/auth/error`).

## Implementation checklist
- [ ] `Icon` + `Avatar` primitives
- [ ] `MarketingNav` + `MarketingFooter`
- [ ] `/` Landing Page
- [ ] `/login` Connexion
- [ ] `/signup` + `/verify-email` (glue, retextured examples)
- [ ] `/onboarding/profile` Choix du profil
- [ ] `/terms` Conditions d'utilisation
- [ ] 375 / 768 / 1280 check on each page (`pnpm dev`, resize)
- [ ] `pnpm format && lint && typecheck && test && build`

## Open questions for user
- Flagged above (nav flow, Avatar downgrade, footer copy edit) — proceeding with the stated assumptions; veto any of them and I'll adjust before Phase 3 builds on top.
