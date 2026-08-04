# Phase 13 — Création de compte (Signup redesign) — Banani → Next.js

## Source
- Banani screen: `SignUp.jsx`, `displayName: 'Création de compte'`, `screenSize: desktop`.
- Replaces `frontend/src/app/signup/page.tsx`, which was a Phase-2 "glue" page (adapted from `examples/frontend-pages/signup.tsx`, not sourced from a Banani design — no signup screen had been fetched yet at the time).

## Confirmed decisions (asked user, all answered)
1. **Établissement/Université** — free-text field, find-or-create `Institution` by name (case-insensitive `findFirst` then `create` if not found) inside the signup transaction. No new list/search endpoint. Accepted simplification: two concurrent signups with the exact same brand-new institution name could theoretically create two rows (no unique constraint) — extremely low probability, harmless (no security/data-loss impact), consistent with prior "approximation over engineering" calls (e.g. Phase 3's pending-comments count).
2. **Password complexity** — Banani's copy ("Au moins 8 caractères, avec majuscules et chiffres") becomes real: add an uppercase + digit requirement server-side, on top of the existing `PASSWORD_MIN` (10) length + banned-list + optional HIBP checks. New stable error code `PASSWORD_TOO_WEAK`.
3. **CGU consent** — add `User.termsAcceptedAt DateTime?` (nullable, new migration). Checkbox is required to submit (client-side gate) AND the timestamp is persisted server-side at signup — real consent record, not decorative.
4. **Rôle (Professeur/Étudiant)** — stays out of signup. `/onboarding/profile` ("Étape 1 sur 3") remains the sole place profileType is chosen, unchanged. Signup screen keeps Banani's informational note text as-is (it's a policy statement, not an enforced check — no server-side email-domain validation exists or is being added).

## Judgment calls (not asked, low-ambiguity)
- **Nom et prénom** — Banani shows it as a plain required field (no "optionnel" marker, styled identically to email/password) → made **required** at signup, stored directly on `User.name` (already nullable/existing field, populated elsewhere via OAuth/Profil tab).
- **Établissement** — same reasoning, no "optionnel" marker in the design → made **required**.
- **Confirmer le mot de passe** — pure client-side match check against `password`; never sent to the backend (no `confirmPassword` field in the API contract).
- **Branding panel is identical to `/login`'s** (same headline/testimonial/footer, byte-for-byte) — extracting a shared `AuthBrandingPanel` component instead of duplicating a third time (rule of three is a floor: this is the *second* occurrence, worth extracting now). `login/page.tsx` refactored to consume it too — zero visual change there.

## System findings
- `Institution` model existed since Phase 1 but **nothing in the app ever wrote to it** — `institutionId` is dead infrastructure until this phase. Confirmed via grep: no `/api/institutions*` route, no UI referencing institution selection anywhere.
- `POST /api/auth/signup` only accepted `{email, password}`. Enumeration-resistance (D-22) requires the existing-email branch to stay untouched — institution/name/terms only apply to the **new-user** branch, inside the existing `prisma.$transaction`.
- Existing signup tests use passwords with no uppercase/digit (`'a-strong-passphrase'`, `'a-very-unique-passphrase-1234'`) — these will need updating to satisfy the new complexity rule, since they test unrelated behavior (dedup, rate-limit) and shouldn't incidentally fail on `PASSWORD_TOO_WEAK`.

## Token mapping (Banani → project)
Identical token set to every other ThèseFacile screen (already in `globals.css` `@theme` since Phase 1) — no new tokens needed. Reuses `bg-foreground` branding panel, `bg-input`/`border-border` field shells, `bg-primary` CTA — all already-established classes from `/login`.

## Component breakdown
- **NEW** `frontend/src/components/marketing/AuthBrandingPanel.tsx` — extracted from `/login`'s inline JSX (logo, headline, testimonial, footer). No props needed (content is static marketing copy, identical on both screens).
- **REWRITE** `frontend/src/app/signup/page.tsx` — full Banani-sourced form.
- **REFACTOR** `frontend/src/app/login/page.tsx` — swap inline branding panel JSX for `<AuthBrandingPanel />`. No visual change.
- **Icon.tsx** — add `user-plus` (Banani's submit-button icon).

## Responsive plan (Banani is desktop-only, `screenSize: desktop`)
Mirrors `/login`'s already-shipped pattern exactly:
- **Base (375px)**: branding panel hidden (`hidden ... lg:flex`), form full-width with its own small inline logo lockup (shown `lg:hidden`), all fields stacked, full-width CTA.
- **lg (1024px+)**: `AuthBrandingPanel` appears at `w-2/5`, form panel takes the remaining space, matching Banani's desktop split exactly.
- No sm/md-specific overrides needed beyond what `/login` already established (the form column itself is a single `max-w-sm` block at all sizes ≥375px, centered).

## Interactions / state
- Client-side: confirm-password mismatch → inline error, blocks submit before any network call.
- Terms checkbox unchecked → submit button logic still fires but server would reject; simpler to also gate client-side (`disabled` when unchecked) — real UX, not just decorative, since the state is real (`termsAccepted` boolean).
- Password field `eye-off` icon in Banani mock is decorative (static icon, no show/hide toggle in the source) — matches `/login`'s existing password field (no toggle either). Not adding a show/hide toggle here to stay consistent with the sibling screen; flagged as a possible future enhancement, not a regression (Banani's own icon is non-interactive too, just an icon).
- Loading/disabled state on submit button, same pattern as `/login`/existing `/signup`.
- Error surfacing: existing `ApiError` → message pattern, extended to show the new `PASSWORD_TOO_WEAK` message text from the server.

## Copy / i18n
All French, inline (this codebase keeps UI strings inline in JSX per every prior phase — there is no `constants.ts` i18n table in this project, unlike the skill's generic template assumption). New strings: "Nom et prénom", "Établissement / Université", "Confirmer le mot de passe", "J'accepte les conditions d'utilisation et la politique de confidentialité" (linking real `/terms` — no separate privacy-policy route exists, so both phrases point to `/terms`, matching the only real legal page that exists), institutional-email note (verbatim from Banani).

## Backend changes
- `frontend/prisma/schema.prisma`: `User.termsAcceptedAt DateTime?` — new migration `..._thesefacile_signup_terms_and_profile`.
- `frontend/src/app/api/auth/signup/route.ts`:
  - `Body` schema gains `name` (trim, 1-200), `institution` (trim, 1-200), `termsAccepted: z.literal(true)`.
  - New complexity check (uppercase + digit regex) after the length check, before HIBP → `PASSWORD_TOO_WEAK`.
  - New-user branch: inside the transaction, `tx.institution.findFirst({where: {name: {equals: institution, mode: 'insensitive'}}})` → create if absent → `tx.user.create({..., name, institutionId, termsAcceptedAt: new Date()})`.
  - Existing-email branch untouched (enumeration resistance preserved exactly).
- Tests: update the 2 existing passphrase fixtures to include an uppercase + digit; add tests for `PASSWORD_TOO_WEAK`, institution find-or-create (both branches: existing institution reused, new institution created), `termsAccepted` required (`VALIDATION_FAILED` when `false`/missing), and `name` required.

## Implementation checklist
- [ ] `AuthBrandingPanel` extracted, `/login` refactored to use it (no visual diff)
- [ ] `Icon.tsx`: add `user-plus`
- [ ] Schema: `User.termsAcceptedAt` + migration
- [ ] `POST /api/auth/signup`: name/institution/termsAccepted + password complexity + tests updated/added
- [ ] `/signup` page rebuilt mobile-first (375 base, `lg:` branding panel) matching Banani's desktop layout at `lg:`+
- [ ] 375px check — single column, no overlap, full-width CTA
- [ ] 768px check — same as 375 (branding panel only appears at `lg:`, matching `/login`'s precedent)
- [ ] 1280px check — matches Banani desktop mockup
- [ ] `pnpm format && lint && typecheck && test && build`
- [ ] Dev-server smoke check
- [ ] `STATUS.md` updated, atomic commit

## Open questions for user
None outstanding — all 4 ambiguities were resolved above before starting.
