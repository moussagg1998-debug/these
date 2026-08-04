# Banani implementation status — ThèseFacile

Last updated: 2026-08-04 (Phase 14)

Flow: [ThèseFacile](https://app.banani.co/flow/YQWElzV_9JrI) (Banani project `YQWElzV_9JrI`) — 20 screens fetched (`new_screen7.jsx` "Messagerie — Côté Encadrant" added to the Banani project after the initial 19-screen fetch; retrieved once the Banani MCP was reconnected mid-Phase-10).

## Done

### Phase 1 — Fondations (2026-08-03)
- [x] Tokens Tailwind ThèseFacile (`frontend/src/app/globals.css` — `@theme`)
- [x] Schéma Prisma : `Institution`, `Thesis`, `Document`, `Comment`, `Deadline`, `Message` + `User.profileType`/`institutionId` + `Order.institutionId` — migration `20260803200629_thesefacile_core`
- [x] Guard `frontend/src/lib/server/theses/guards.ts` (`requireProfileType`, `resolveThesisAccess`)
- [x] `GET/POST /api/theses`, `GET/PATCH /api/theses/[id]`
- [x] `GET/POST /api/theses/[id]/documents`
- [x] `GET/POST /api/theses/[id]/comments`
- [x] `GET/POST /api/theses/[id]/deadlines`
- [x] `GET/POST /api/theses/[id]/messages`
- [x] `GET/PATCH /api/profile` (Choix du profil — one-shot)
- [x] 48 nouveaux tests Vitest (625/625 verts), lint/typecheck/build clean

### Phase 2 — Auth & onboarding (2026-08-03)
- [x] `landing-page` — "Landing Page" — `frontend/src/app/page.tsx` — plan: `phase-2-auth-onboarding.md`
- [x] `login` — "Connexion" — `frontend/src/app/login/page.tsx`
- [x] `profile-choice` — "Choix du profil" — `frontend/src/app/onboarding/profile/page.tsx`
- [x] `terms` — "Conditions d'utilisation" — `frontend/src/app/terms/page.tsx`
- [x] Glue (not Banani-sourced): `/signup`, `/verify-email` — retextured from `examples/frontend-pages/`
- [x] Primitives: `components/ui/Icon.tsx`, `components/ui/Avatar.tsx`, `components/marketing/{MarketingNav,MarketingFooter}.tsx`
- [x] `lucide-react` added as a dependency
- [x] format/lint/typecheck/test(625/625)/build all green; dev-server smoke check (curl 200 + content match) on all 6 pages
- [ ] **Not verified**: actual browser rendering at 375/768/1280px — no browser/screenshot tool available in this session. Mobile-first Tailwind classes were written deliberately (unprefixed = 375px base, `sm:`/`md:`/`lg:` layer up) but a human should eyeball it in a real browser before calling Phase 2 fully done.

### Phase 3 — Encadrant core (2026-08-03)
- [x] `dashboard-encadrant` — "Dashboard Encadrant" — `frontend/src/app/dashboard/page.tsx`
- [x] `student-list` — "Mes étudiants — Liste" — `frontend/src/app/students/page.tsx`
- [x] `add-student` — "Ajouter un étudiant" (modal) — `frontend/src/components/dashboard/AddStudentForm.tsx`
- [x] `student-added` — reused the existing `ToastProvider`/`useToast()` instead of a bespoke `SuccessMessage` screen/component (see plan doc § routing decision) — no separate route
- [x] `student-detail` — "Détail Étudiant — Profil" — `frontend/src/app/students/[id]/page.tsx` (Aperçu tab only; Documents/Commentaires/Historique tabs inert, Phase 4)
- [x] Shared: `Sidebar`, `DashboardShell` (mobile drawer), `StatCard`, `StudentRow`, `ActivityItem`, `FilterBar`, `StudentProfileSidebar` under `frontend/src/components/dashboard/`; `frontend/src/lib/theses.ts` (types + formatting helpers)
- [x] Backend: `stage`/`deadlineAt` added to `POST /api/theses`; `GET /api/theses` and `GET /api/theses/[id]` enriched with `documents`/`deadlines`/`_count.comments`; `GET /api/profile` now also returns `name`/`email` — all with test coverage (628/628 green)
- [x] Fixed a pre-existing Phase 2 bug: `graduation-cap` icon was used everywhere (nav/login/signup/onboarding logos) but missing from `Icon.tsx`'s `ICONS` map, so the logo mark silently rendered nothing
- [x] Post-login / post-profile-choice redirect now sends `ENCADRANT` to `/dashboard` (was `/`, a Phase-2-era placeholder since no dashboard existed yet)
- [x] format/lint/typecheck/test(628/628)/build all green; dev-server smoke check (curl 200) on `/dashboard`, `/students`, `/login`
- [ ] **Not verified**: actual browser rendering at 375/768/1280px — same caveat as Phase 2, no browser/screenshot tool available in this session
- Plan: `.planning/banani/phase-3-encadrant-core.md` (includes the deliberate simplifications: "pending comments" = total count not resolved/unresolved, "submissions this week" approximated from latest-doc-per-thesis)

### Phase 4 — Documents & Commentaires (2026-08-04)
- [x] `documents-library` — "Bibliothèque de documents" — `frontend/src/app/documents/page.tsx`
- [x] `comments-overview` — "Commentaires — Vue d'ensemble" — `frontend/src/app/comments/page.tsx`
- [x] Shared: `DocumentRow`, `CommentThread` (resolve-toggle wired to real PATCH) under `frontend/src/components/dashboard/`
- [x] Schema: `Document.fileName`/`sizeBytes` (optional — Phase 6 upload will populate), `Comment.resolved`/`priority` — migration `20260803225956_thesefacile_documents_comments_triage`
- [x] Backend: new cross-thesis aggregates `GET /api/documents`, `GET /api/comments`, `PATCH /api/comments/[id]` (encadrant-only resolve toggle); extended `POST /api/theses/[id]/documents` (`fileName`/`sizeBytes`) and `.../comments` (`priority`) — all with test coverage (650/650 green)
- [x] StudentDetail's "Documents"/"Commentaires" tabs (inert since Phase 3) now link to `/documents?studentId=`/`/comments?studentId=` — "Historique" stays inert (no Banani source for it)
- [x] format/lint/typecheck/test(650/650)/build all green; dev-server smoke check (curl 200 + content match) on `/documents`, `/comments`
- [ ] **Not verified**: actual browser rendering at 375/768/1280px — same caveat as every prior phase, no browser/screenshot tool available in this session
- Plan: `.planning/banani/phase-4-documents-comments.md` (documents the "resolved is a boolean not a real read-receipt", "Non lus" inert, and Document metadata simplifications)

### Phase 5 — Échéances & Jalons (2026-08-04)
- [x] `deadline-calendar` — "Échéances — Calendrier" — `frontend/src/app/deadlines/page.tsx`
- [x] `add-deadline` — "Ajouter une échéance" (modal) — `frontend/src/components/dashboard/AddDeadlineForm.tsx`, reuses existing `POST /api/theses/[id]/deadlines`
- [x] Shared: `DeadlineCard` under `frontend/src/components/dashboard/`; `deadlineUrgencyBucket`/`daysUntil` helpers in `frontend/src/lib/theses.ts`
- [x] Schema: `Deadline.description` (optional) — migration `20260803233622_thesefacile_deadline_description`
- [x] Backend: new cross-thesis aggregate `GET /api/deadlines` (encadrant-only, `take: 200`, not cursor-paginated — see plan doc); extended `POST /api/theses/[id]/deadlines` (`description`) — all with test coverage (657/657 green)
- [x] Dashboard's "Prochaines échéances" panel gets a "Voir tout" link to `/deadlines` (parity with the students table's link)
- [x] format/lint/typecheck/test(657/657)/build all green; dev-server smoke check (curl 200 + content match) on `/deadlines`, 401 on unauthenticated `/api/deadlines`
- [ ] **Not verified**: actual browser rendering at 375/768/1280px — same caveat as every prior phase, no browser/screenshot tool available in this session
- Plan: `.planning/banani/phase-5-deadlines.md` (documents the days-until-due bucket vs. stored `urgency` priority distinction, the new `description` field, and the inert reminder checkbox)

### Phase 6 — Paramètres & Préférences (2026-08-04)
- [x] `encadrant-settings` — "Paramètres — Compte & Préférences" — `frontend/src/app/settings/page.tsx` (branches on `profileType`; non-ENCADRANT accounts keep the pre-existing generic password/Google-linking page verbatim)
- [x] Shared: `SettingSection` (real toggle + collapse), `PasswordSettingsModal` (ported from the generic page) under `frontend/src/components/dashboard/`
- [x] Backend: `GET /api/profile` now also returns `institution: {id, name} | null`; reuses existing `PATCH /api/notifications/prefs`, `PUT /api/auth/change-password`, `POST /api/auth/set-password`, `GET /api/auth/oauth/google/start` — no new routes — all with test coverage (658/658 green)
- [x] `Icon.tsx`: added `chevron-up`
- [x] format/lint/typecheck/test(658/658)/build all green; dev-server smoke check (curl 200 + content match) on `/settings`, 401 on unauthenticated `/api/profile`, `/dashboard` unaffected
- [ ] **Not verified**: actual browser rendering at 375/768/1280px — same caveat as every prior phase, no browser/screenshot tool available in this session
- Plan: `.planning/banani/phase-6-encadrant-settings.md` (documents which Notifications/Sécurité/Général items are real vs. inert, the pre-existing gap where notification prefs aren't yet enforced in the creation pipeline, and the Google-linking addition beyond Banani's mock)

### Phase 7 — Dashboard Étudiant (2026-08-04)
- [x] `dashboard-etudiant` — "Dashboard Étudiant" — `/dashboard` ETUDIANT branch (same reuse pattern as Phase 6's `/settings`), replacing the old "réservé aux encadrants" placeholder
- [x] Shared: `StudentNav`, `StudentDocumentRow`, `StudentCommentItem`, `StudentDashboardContent` under `frontend/src/components/student/` (new directory)
- [x] Backend: `GET /api/theses/[id]/comments` extended (`author.email`, `document.chapter`) — no new routes, everything else reuses Phase 1's already-dual-sided per-thesis routes for the first time
- [x] **Bug fix**: `Comment.documentId` had no real Prisma relation since Phase 1 — `GET /api/comments` (Phase 4) already tried to `include: {document}`, which would throw at runtime against a real DB (fully-mocked tests never caught it). Fixed with a proper `Comment.document`/`Document.comments` relation — migration `20260804004938_thesefacile_comment_document_relation`
- [x] `Icon.tsx`: added `alert-circle`
- [x] format/lint/typecheck/test(659/659)/build all green; dev-server smoke check (curl 200 + content match) on `/dashboard`, 401 on unauthenticated `/api/theses` + `/api/notifications/count`, `/settings` + `/deadlines` unaffected
- [ ] **Not verified**: actual browser rendering at 375/768/1280px — same caveat as every prior phase, no browser/screenshot tool available in this session
- Plan: `.planning/banani/phase-7-dashboard-etudiant.md` (documents the dropped 8-step milestone curriculum, the 2-state document status derivation, and why student-side comment resolution stays disabled)

### Phase 8 — Dépôt de fichier étudiant (2026-08-04)
- [x] `student-file-upload` — "Dépôt de fichier étudiant" — `frontend/src/app/documents/new/page.tsx` (new nested route, sibling of Phase 4's ENCADRANT-only `/documents`, not a branch of it)
- [x] Shared: `StudentFileUploadForm` under `frontend/src/components/student/`; `frontend/src/lib/uploadFile.ts` (multipart upload helper — `api()` can't do FormData, see plan doc)
- [x] Backend: no new routes/schema. Reuses `POST /api/upload` → `POST /api/theses/[id]/documents` → optionally `POST /api/theses/[id]/comments` (student's "notes" become a comment linked to the new document, reusing Phase 7's bug-fixed relation instead of a new schema field)
- [x] `frontend/src/lib/server/upload/sniff.ts` — added DOCX/ODT magic-byte sniffers (ZIP signature + format fingerprint scan) + new `sniff.test.ts` (7 tests, first direct coverage of this file)
- [x] `frontend/.env.local` (untracked, local-only) — `UPLOAD_ALLOWED_MIME` widened to include PDF/DOCX/ODT; the shared `.env.example` starter default is untouched (still image-only, pinned by `env-shape.test.ts`) — real deployments of this fork must set this themselves
- [x] format/lint/typecheck/test(666/666)/build all green; dev-server smoke check (curl 200 on `/documents/new`, `/dashboard`, `/settings`, `/deadlines`; 401 on unauthenticated `/api/theses`; 403 on unauthenticated `POST /api/upload`)
- [ ] **Not verified**: actual browser rendering at 375/768/1280px — same caveat as every prior phase, no browser/screenshot tool available in this session
- Plan: `.planning/banani/phase-8-student-file-upload.md` (documents the dropped version field/chapter-position box, notes-as-comment reuse, and why the MIME allowlist was widened locally rather than in the shared starter contract)

### Phase 9 — Messagerie étudiant-encadrant + calendrier (2026-08-04)
- [x] `student-messaging` + `add-to-calendar-modal` — "Messagerie étudiant-encadrant" + "Ajout au calendrier — Modal" — `frontend/src/app/messages/page.tsx` (new top-level route, ETUDIANT-only, already linked from Phase 7's dashboard)
- [x] Shared: `StudentMessagingContent`, `AddToCalendarModal` under `frontend/src/components/student/`; `frontend/src/lib/ics.ts` (hand-rolled RFC 5545 `.ics` generator, no library)
- [x] Backend: no new routes/schema. Reuses `GET/POST /api/theses/[id]/messages` (Phase 1, already dual-sided, already notifies), `GET /api/theses/[id]/deadlines`, `GET /api/theses/[id]/documents` — chat polls every 5s (periodic refetch, per the already-resolved "no Ably for MVP" decision)
- [x] **Re-scoped "add to calendar"**: no `Meeting` model exists, so the feature exports the thesis's real next `Deadline` as a downloadable `.ics` file (with a working reminder + notes) instead of fabricating a scheduled meeting with a fake office location
- [x] `Icon.tsx`: added `paperclip`, `phone`, `calendar-plus`, `bell-off`, `flag`
- [x] format/lint/typecheck/test(673/673)/build all green; dev-server smoke check (curl 200 on `/messages`, `/documents/new`, `/dashboard`; 401 on unauthenticated `/api/theses`)
- [ ] **Not verified**: actual browser rendering at 375/768/1280px — same caveat as every prior phase, no browser/screenshot tool available in this session
- Plan: `.planning/banani/phase-9-student-messaging.md` (documents the meeting→deadline re-scoping, the dropped fake calendar-app selector, and why "Fichiers récents" was made real instead of dropped)

### Phase 10 — Onglet Profil encadrant (2026-08-04)
- [x] `encadrant-profile-tab` — folds `new_screen1.jsx` (previously mislabeled "Paramètres Utilisateur" / re-scoped out of the student side in Phase 7) into `/settings` as a new "Profil" tab (default), alongside the existing 5 `SettingSection`s now under a "Paramètres" tab
- [x] Shared: `ProfileTab` under `frontend/src/components/dashboard/`
- [x] Schema: `User.department`/`academicGrade`/`specialties String[]`/`bio` (all optional) — migration `20260804023635_thesefacile_encadrant_profile_fields`
- [x] Backend: `PATCH /api/profile` widened from a strict one-shot `profileType`-only route to also accept the new fields unconditionally (the one-shot 409 lock now only fires when `profileType` is actually part of the request); `GET /api/profile` now also returns `emailVerified` (derived from `emailVerifiedAt`, not a new field) + the new fields
- [x] "Encadrant vérifié" badge derived from real `emailVerifiedAt`, not a new manual-verification field
- [x] `GET /api/theses` + `ThesisPerson` extended with `bio`; surfaced in Phase 7's dashboard and Phase 9's messaging "Mon encadrant" cards (so the tab's "visible par vos étudiants" label is actually true)
- [x] `Icon.tsx`: added `camera`
- [x] format/lint/typecheck/test(678/678)/build all green; dev-server smoke check (curl 200 on `/settings`, `/dashboard`, `/messages`; 401 on unauthenticated `/api/profile` + `/api/theses`)
- [x] **Responsive**: code-based audit only (no browser tool this session) — grepped for non-stacking grids/flex-rows/fixed-width sidebars across the whole app; none found. Not a substitute for real visual verification.
- Plan: `.planning/banani/phase-10-encadrant-profile-tab.md` (documents the dropped phone/plan-tier/max-students fields, why avatar photo upload was left inert despite cheap infra, and the free-text-with-suggestions grade field)

### Phase 11 — Messagerie côté encadrant (2026-08-04)
- [x] `encadrant-messaging` — "Messagerie — Côté Encadrant" (`new_screen7.jsx`) — `/messages` ENCADRANT branch (same profileType-branch pattern as `/settings`/`/dashboard`), wrapped in the existing `DashboardShell`/`Sidebar` chrome rather than Banani's one-off top nav for this screen
- [x] Shared: `EncadrantMessagingContent` under `frontend/src/components/dashboard/`; reuses `AddToCalendarModal` (Phase 9) unchanged for both "Planifier une réunion" entry points
- [x] Backend: **new** `GET /api/messages` — the cross-thesis inbox aggregate messaging never got when Phases 4-5 built the same shape for documents/comments/deadlines. Per-thesis unread count derived from existing `MESSAGE_RECEIVED` notifications (grouped by `data.thesisId`, no new schema); opening a conversation marks those notifications read via the existing `PATCH /api/notifications`
- [x] `Sidebar.tsx`: added a real "Messages" nav item (`NAV_ITEMS`)
- [x] `Icon.tsx`: added `more-horizontal`
- [x] Composer quick-actions ("Proposer un rendez-vous"/"Valider un chapitre") are real text-template inserts into the message draft, not new backend concepts; "chapitre actif" is a derived proxy (latest document's chapter)
- [x] format/lint/typecheck/test(686/686)/build all green; dev-server smoke check (curl 200 on `/messages`, `/dashboard`, `/settings`, `/students`; 401 on unauthenticated `/api/messages` + `/api/theses`)
- [x] **Responsive**: code-based audit only (no browser tool this session) — traced the new mobile/desktop JS-driven pane toggle plus the standard grid/flex-row checks from Phase 10; no issues found. Not a substitute for real visual verification.
- Plan: `.planning/banani/phase-11-encadrant-messaging.md` (documents the new cross-thesis aggregate, the notification-derived unread count, and the meeting/calendar reuse from Phase 9)

### Phase 12 — Real browser responsive QA + 2 race-condition fixes (2026-08-04)
- [x] First **real** (non-code-audit) browser verification of the port, closing the "Not verified: actual browser rendering" caveat carried since Phase 2. Method: Playwright driving the machine's existing Chrome (no download needed) against `pnpm dev`, seeded with realistic ThèseFacile data (1 encadrant + 2 étudiants, theses/documents/comments/deadlines/messages) via a temporary seed script (created, used, then deleted — not part of the shipped starter).
- [x] Automated horizontal-overflow check (`scrollWidth` vs `clientWidth`) across every encadrant + étudiant screen at 375/768/1280px — **0 overflows** found across 48 checks.
- [x] Visual screenshot review at all 3 breakpoints for the newest screens (Phase 10's Profil tab, Phase 11's encadrant messaging) plus spot-checks across the rest — layouts hold up correctly at every breakpoint (mobile single-column, tablet 2-column, desktop full sidebar/3-column); the `/students` filter tabs intentionally horizontal-scroll on narrow viewports (`overflow-x-auto`, pre-existing, correct).
- [x] **Bug found & fixed** — `frontend/src/app/messages/page.tsx` crashed (`Cannot read properties of null (reading 'name')`) for both profile types. Root cause: `stillResolving` only checked `profileLoading`, not `!profile` — on the render where `user` resolves one tick before the `/api/profile` fetch's `loading` flag catches up, the guard fell through while `profile` was still `null`, hitting `profile!.name`. Fixed by adding `!profile` to the guard, matching the safer pattern already used in `dashboard/page.tsx`.
- [x] **Second bug found & fixed** (same file + `frontend/src/app/documents/new/page.tsx`) — a **wrongful redirect to `/dashboard`** for a valid étudiant with an assigned thesis. Root cause: the same class of stale-flag race, one level down — `isStudent` flips `true` the instant `profile` loads, but the dependent `useApi('/api/theses', {skip: !isStudent})` call's `loading` flag hadn't caught up yet, so `thesesLoading && !thesesRes` read `false && true`, letting `studentWithoutThesis`/`shouldRedirect` fire on the still-null `thesesRes`. Fixed in both files by dropping reliance on the loading flag entirely: `isStudent && !thesesRes` (loading-flag-independent — correct regardless of timing).
- [x] Both fixes verified with real re-navigation in the browser (not just code review): `/messages` and `/documents/new` now stay on their own URL and render correctly for a real étudiant account with a real thesis, at the cost of this dev environment's slow Neon round-trips (~3-8s/query from this machine — a local network/environment characteristic, not a code defect; harmless in production where Vercel↔Neon-pooler latency is far lower and React StrictMode's dev-only double-effect-invoke doesn't run at all).
- [x] format/lint/typecheck/test(686/686)/build all green after the fixes
- No plan file — this was a verification + bugfix pass on already-shipped phases (2–11), not a new screen.

### Phase 13 — Création de compte (Signup redesign) (2026-08-04)
- [x] `signup` — "Création de compte" (`SignUp.jsx`) — `frontend/src/app/signup/page.tsx` fully rebuilt, replacing the Phase-2 non-Banani "glue" page
- [x] Shared: **NEW** `frontend/src/components/marketing/AuthBrandingPanel.tsx`, extracted from `/login`'s inline branding panel (second occurrence → rule-of-three extraction); `/login` refactored to consume it, zero visual change
- [x] Schema: `User.termsAcceptedAt DateTime?` — migration `20260804052011_thesefacile_signup_terms`
- [x] Backend: `POST /api/auth/signup` — `Body` gains `name` (required), `institution` (required, free-text find-or-create against `Institution`, no unique constraint — accepted low-probability race duplicate), `termsAccepted: z.literal(true)`; new password-complexity gate (`PASSWORD_TOO_WEAK` — uppercase + digit) makes the Banani copy real instead of decorative; existing-email enumeration-resistant branch untouched. `institutionId`/`Institution` model were dead infrastructure since Phase 1 (nothing ever wrote to them) — now genuinely wired
- [x] `Icon.tsx`: added `user-plus`
- [x] `frontend/scripts/smoke-auth.ts` updated for the new required signup fields
- [x] 5 new/updated tests in `route.test.ts` (institution reuse vs create, `PASSWORD_TOO_WEAK`, required `name`/`institution`/`termsAccepted`) — 691/691 total
- [x] format/lint/typecheck/test(691/691)/build all green
- [x] **Real browser QA** (Playwright + system Chrome, per Phase 12's method): 0/3 overflow checks at 375/768/1280px; full real signup submission verified end-to-end (redirects to `/verify-email?email=…`); submit button confirmed disabled until CGU checked; password-mismatch inline error confirmed; `/login` screenshotted post-refactor to confirm the shared `AuthBrandingPanel` extraction is pixel-identical. Test data cleaned up after.
- Plan: `.planning/banani/phase-13-signup-redesign.md` (documents the 4 user-confirmed decisions — free-text institution find-or-create, real password complexity, persisted CGU consent, role selection staying on `/onboarding/profile` — plus the `name`/`institution`-required judgment calls)

### Phase 14 — Audit complet de l'application (2026-08-04)
- [x] Audit de code des 16 pages (via 3 sous-agents en parallèle) : appels API, liens internes, formulaires/modales, états loading/error/empty, race conditions, responsive.
- [x] **Bug critique corrigé** — `login/page.tsx` et `onboarding/profile/page.tsx` redirigeaient tout utilisateur non-ENCADRANT (donc tout ÉTUDIANT) vers `/` au lieu de `/dashboard`, un reliquat de commentaire Phase-2 jamais mis à jour après la Phase 7 (dashboard étudiant). Rendait le dashboard/messagerie/upload étudiant inaccessibles via l'UI normale.
- [x] **Lien mort corrigé** — `/forgot-password` n'existait pas (seule l'API existait). Pages `/forgot-password` et `/reset-password` construites à partir des exemples, restylées aux tokens ThèseFacile, `/login` affiche une confirmation post-reset.
- [x] **3 bugs Windows corrigés** — `smoke-auth.ts`, `seed-dev.ts`, `make-superadmin.ts` avaient un garde d'entrée ESM (`import.meta.url === file://${argv[1]}`) qui échoue toujours sur Windows (backslashes vs slashes) : les 3 scripts s'exécutaient silencieusement sans rien faire. Corrigé avec `pathToFileURL`.
- [x] **Lacune de pagination systémique corrigée** — `/api/theses`, `/api/documents`, `/api/comments` plafonnaient à 20 résultats sans moyen d'en charger plus ni total réel. Ajout d'un champ `total` (compte réel) + bouton "Charger plus" sur `/students`, `/documents`, `/comments` ; KPI "Étudiants suivis" du dashboard maintenant exact.
- [x] **Bug de fiabilité découvert et corrigé pendant la QA** — le premier correctif de pagination utilisait `Promise.all([findMany, count])`, qui sature le pool de connexions Neon (`connection_limit=1`, requis en serverless) et provoque des 500 sous charge. Corrigé en exécutant les requêtes séquentiellement.
- [x] Incohérences corrigées : "Pas reçu de code ?" sur `/verify-email` appelle maintenant réellement `POST /api/auth/resend-verification` (au lieu de renvoyer vers `/signup`) ; `/auth/error` restylée aux tokens du design system (elle utilisait encore le gabarit `examples/` brut) ; l'ajout d'un commentaire sur la fiche étudiant rafraîchit maintenant le compteur "Retours" ; `uploadFile.ts` retente désormais une fois après un refresh de token 401 (comme `api()`), corrigeant un échec silencieux si le token expire pendant le remplissage du formulaire d'upload.
- [x] QA navigateur réelle (Playwright + Chrome système) : 25 thèses de test créées pour valider concrètement la pagination, parcours complet encadrant + étudiant + cas limite (étudiant sans thèse) aux 3 breakpoints, 0 dépassement horizontal, `pnpm build` propre (18 pages, 54 routes API).
- [x] format/lint/typecheck/test(694/694)/build tous verts.
- Points restants documentés dans le rapport d'audit final (favicon manquant, liens marketing `#` décoratifs, pied de page `/terms` inerte, KPIs secondaires du dashboard toujours approximatifs au-delà de 20 thèses).

## In progress
_(none — every fetched Banani screen for both sides is now built)_

## Pending (fetched, planned at a high level in IMPLEMENTATION-PLAN.md, not yet detailed/built)
_(none)_

## Open design questions
Resolved 2026-08-03 — see `IMPLEMENTATION-PLAN.md` §6 for the 7 confirmed decisions (profileType field, cardinality, monetization kept, back-office kept, messaging = periodic refetch, calendar sync = decorative for MVP, profile choice fixed at signup).
- **Resolved 2026-08-04**: `new_screen1.jsx` ("Paramètres Utilisateur") mislabeling — user chose to fold it into `/settings` as a "Profil" tab. Built in Phase 10.

## Shared component inventory (from Banani `sharedFiles`)
- `/style.css` — theme tokens (see IMPLEMENTATION-PLAN.md § Design tokens)
- `Sidebar.jsx`, `StatCard.jsx`, `StudentRow.jsx`, `ActivityItem.jsx`, `AddStudentForm.jsx`, `FilterBar.jsx`, `AddDeadlineForm.jsx`, `SettingSection.jsx`, `DeadlineCard.jsx`, `CommentThread.jsx`, `SuccessMessage.jsx`, `StudentProfileSidebar.jsx`
- Global (Banani-provided, not custom): `Icon` (Lucide), `UserAvatar`
