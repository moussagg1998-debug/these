# Banani implementation status — ThèseFacile

Last updated: 2026-08-04 (Phase 5)

Flow: [ThèseFacile](https://app.banani.co/flow/YQWElzV_9JrI) (Banani project `YQWElzV_9JrI`) — 19 screens fetched.

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

## In progress
_(none yet — next up: `encadrant-settings`)_

## Pending (fetched, planned at a high level in IMPLEMENTATION-PLAN.md, not yet detailed/built)

### Encadrant (supervisor) side
- [ ] `encadrant-settings` — "Paramètres — Compte & Préférences"

### Étudiant (student) side
- [ ] `dashboard-etudiant` — "Dashboard Étudiant"
- [ ] `student-file-upload` — "Dépôt de fichier étudiant"
- [ ] `student-messaging` — "Messagerie étudiant-encadrant"
- [ ] `add-to-calendar-modal` — "Ajout au calendrier — Modal"
- [ ] `user-settings` — "Paramètres Utilisateur"

## Open design questions
Resolved 2026-08-03 — see `IMPLEMENTATION-PLAN.md` §6 for the 7 confirmed decisions (profileType field, cardinality, monetization kept, back-office kept, messaging = periodic refetch, calendar sync = decorative for MVP, profile choice fixed at signup).

## Shared component inventory (from Banani `sharedFiles`)
- `/style.css` — theme tokens (see IMPLEMENTATION-PLAN.md § Design tokens)
- `Sidebar.jsx`, `StatCard.jsx`, `StudentRow.jsx`, `ActivityItem.jsx`, `AddStudentForm.jsx`, `FilterBar.jsx`, `AddDeadlineForm.jsx`, `SettingSection.jsx`, `DeadlineCard.jsx`, `CommentThread.jsx`, `SuccessMessage.jsx`, `StudentProfileSidebar.jsx`
- Global (Banani-provided, not custom): `Icon` (Lucide), `UserAvatar`
