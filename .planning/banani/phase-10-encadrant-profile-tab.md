# Phase 10 — Onglet Profil (encadrant) — Banani → Next.js

## Source
- Banani screen: `new_screen1.jsx`, `displayName: 'Paramètres Utilisateur'` — previously flagged in Phase 7/STATUS.md as **mislabeled**: its actual content is a richer ENCADRANT profile-editing screen (own `Sidebar` + a left tab nav: Profil/Sécurité/Notifications/Abonnement/Préférences/Données), not a student screen.
- User decision (2026-08-04): fold the useful fields into the existing `/settings` page (Phase 6) as a new **"Profil" tab**, rather than building new_screen1.jsx's own tabbed layout wholesale (which would duplicate Phase 6's Sécurité/Notifications/Données sections under different tab names) or treating it as a superseded draft.

## Routing decision — new tab inside the existing ENCADRANT branch of `/settings`
No new route. `EncadrantSettingsContent` (Phase 6) gains a 2-tab switcher: **Profil** (new, default) and **Paramètres** (the existing 5 `SettingSection`s, unchanged). The shared header (avatar, name, email, institution/member-since badges) stays above both tabs — new_screen1.jsx's own header block overlaps heavily with what Phase 6 already built there, so it isn't duplicated per-tab.

## System findings
- **`PATCH /api/profile` is currently a one-shot onboarding route** (`profileType` only, 409 `PROFILE_ALREADY_SET` if already set — by deliberate Phase 1 design, confirmed by reading the route + its tests). It cannot be reused as-is for post-onboarding profile edits. Resolution: widen the Zod body to make `profileType` *optional* and add optional `name`/`department`/`academicGrade`/`specialties`/`bio`; the one-shot 409 check now only fires when the request actually includes `profileType` and it's already set — every other field updates freely regardless of onboarding state. This preserves the existing invariant (tested) while making the route reusable.
- **New fields have no schema backing at all**: `department`, `academicGrade`, `specialties` (tags), `bio` don't exist anywhere on `User`. Added as plain optional columns on `User` (matching the existing flat convention — `profileType`/`institutionId` already live directly on `User`, not a separate `EncadrantProfile` table).
- **"Encadrant vérifié" badge** — no manual verification workflow exists or is being added. Derived honestly from the already-real `emailVerifiedAt !== null` (the same signal used for account verification elsewhere), not a new field. Now returned by `GET /api/profile`, which didn't previously select it.
- **The "visible par vos étudiants" bio claim would be dishonest if nothing ever displayed it.** Extended `ThesisPerson` (`lib/theses.ts`) + `GET /api/theses`'s `encadrant`/`student` select with `bio`, and surfaced `thesis.encadrant.bio` (when present) in the two places students already see their encadrant's identity: Phase 7's dashboard "Mon encadrant" card and Phase 9's messaging sidebar profile card. Small, contained follow-on to two already-shipped screens — not a redesign.
- `GET /api/theses/[id]` (single-thesis detail, used by `/students/[id]`) is untouched — nothing currently consumes bio from that route.

## Field-scope gaps found + resolution
- **Prénom/Nom as two separate inputs** — `User.name` is a single free-text column everywhere else in the app. Kept as **one** "Nom complet" field rather than fragmenting the schema for this one screen.
- **Téléphone** — no phone field exists anywhere in the auth model (already established in Phase 9's investigation). **Dropped**, not fabricated.
- **"Plan Pro" badge** — implies a subscription-tier concept that doesn't exist for encadrant accounts (Orders/Withdrawals are a different, unrelated domain). **Dropped** — no fake plan tier invented.
- **"Nombre max. d'étudiants"** — would need a new field, AND to actually mean something it would need enforcement in `POST /api/theses`/`AddStudentForm` (a real cap). That's a materially separate feature the user didn't ask for here. **Dropped from this phase** rather than shipping a decorative, unenforced number — flagged explicitly, not silently expanded or silently omitted.
- **Photo de profil real upload** — cheap infrastructure-wise (`User.avatarUrl` already exists, `uploadFile()`/Cloudinary already wired since Phase 8, default image MIME types already allowed), but the shared `Avatar` component (used in ~10+ places app-wide: dashboard, student rows, messaging, comments…) only ever renders initials today. Wiring a real photo here without also propagating it through every `Avatar` usage would be a half-built, confusing feature (uploadable but never visible anywhere except maybe this one screen). **Dropped from this phase's scope**, kept as a visibly inert "Modifier la photo" button (`title="Bientôt disponible"`) rather than shipping a partial win. Flagged for a future phase if photo avatars become a real priority.
- **Grade as a rigid dropdown** — Banani implies a fixed select (chevron-down). No single CAMES/academic-grade taxonomy is guaranteed to match every institution using this fork. Built as a free-text input with a `<datalist>` of common French-academia grade suggestions (Assistant, Maître-Assistant, Maître de Conférences, Professeur Titulaire, Chargé d'Enseignement) — same "convenience without fake enforcement" pattern used for Phase 8's chapter field.
- **Spécialités tags** — real, editable `string[]` (`User.specialties`), add/remove UI matching Banani's chip pattern.
- **Institution** — shown read-only (already displayed in the existing header badge, Phase 6). No self-service institution-change route exists or is being added here.
- **Footer "Supprimer mon compte"** — already exists (inert) in Phase 6's "Compte" section under the Paramètres tab. Not duplicated in the new Profil tab.
- **"Annuler"/"Enregistrer les modifications"** — unlike Phase 6's toggle-based sections (naturally instant-save, no batch to commit), this tab edits several free-text fields together. A real batch-save button here is *more* honest than instant-save-per-keystroke (avoids a PATCH per character) and isn't the "one dishonest no-op button" Phase 6 deliberately removed elsewhere. Both buttons are real: Enregistrer sends one `PATCH /api/profile` with all fields; Annuler resets local form state to the last-fetched profile values.

## Backend
- `frontend/prisma/schema.prisma` — `User` gains `department String?`, `academicGrade String?`, `specialties String[] @default([])`, `bio String?`. Migration `<timestamp>_thesefacile_encadrant_profile_fields`.
- `frontend/src/app/api/profile/route.ts` — `GET` now also selects/returns `emailVerifiedAt`, `department`, `academicGrade`, `specialties`, `bio`. `PATCH`'s `profileType` becomes optional; new optional fields update unconditionally; the one-shot 409 check is scoped to only fire when `profileType` is present in the request body and already set. Requires at least one field in the body.
- `frontend/src/app/api/theses/route.ts` (list `GET`) — `encadrant`/`student` selects gain `bio`.
- `frontend/src/lib/theses.ts` — `ThesisPerson` gains `bio: string | null`.
- `frontend/src/components/student/StudentDashboardContent.tsx` (Phase 7) — "Mon encadrant" card shows `thesis.encadrant.bio` when present.
- `frontend/src/components/student/StudentMessagingContent.tsx` (Phase 9) — sidebar profile card shows `thesis.encadrant.bio` when present.

## Component breakdown
- **NEW** `frontend/src/components/dashboard/ProfileTab.tsx` — the editable form (name, department, academicGrade w/ datalist, specialties tag editor, bio, Annuler/Enregistrer).
- `frontend/src/app/settings/page.tsx` — `EncadrantSettingsContent` gains: a 2-tab switcher (Profil/Paramètres, local `useState`), the "Encadrant vérifié" badge in the existing header badge row, and an inert "Modifier la photo" button next to the avatar.

## Deliberate simplifications (flagged, not silent)
- No real avatar photo upload (infra exists but propagating it app-wide is out of scope here).
- No enforced "max students" cap.
- No fake subscription/plan tier.
- Grade is free text + suggestions, not an enforced taxonomy.
- Institution stays read-only (no self-service change flow).

## Implementation checklist
- [x] Schema fields + migration
- [x] `GET/PATCH /api/profile` extended + tests
- [x] `ThesisPerson.bio` + `GET /api/theses` select
- [x] Bio surfaced in Phase 7 dashboard + Phase 9 messaging
- [x] `ProfileTab` component
- [x] Tab switcher + verified badge in `settings/page.tsx`
- [x] 375/768/1280 check — **code-based audit only, not real visual verification** (no browser/screenshot tool in this session). Grepped the whole `frontend/src` tree for `grid-cols-[2-9]` and fixed-width sidebars (`w-56`/`w-64`/`w-72`): every multi-column grid has a `grid-cols-1` (or similar) base with `sm:`/`md:`/`lg:` overrides; every `flex-row` in the codebase is paired with a `flex-col` base behind a responsive prefix (`sm:flex-row`/`lg:flex-row`/`xl:flex-row`) — no page ships a non-stacking two-column layout; every fixed-width sidebar is either already `w-full lg:w-*`, hidden on mobile (`hidden lg:flex`), or a mobile-only drawer overlay (`DashboardShell`'s `w-64` drawer, correct as a fixed-width slide-in panel). No mobile-breakage patterns found. This does not substitute for an actual rendered check — still flagged not-verified for real pixel/overlap issues.
- [x] `pnpm format && lint && typecheck && test(678/678) && build`
- [x] dev-server smoke check (curl 200 on `/settings`, `/dashboard`, `/messages`; 401 on unauthenticated `/api/profile` + `/api/theses`)
