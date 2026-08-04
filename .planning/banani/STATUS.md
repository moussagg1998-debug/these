# Banani implementation status — ThèseFacile

Last updated: 2026-08-04 (Phase 7)

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

## In progress
_(none yet — next up: Phase 8, dépôt de fichier étudiant)_

## Pending (fetched, planned at a high level in IMPLEMENTATION-PLAN.md, not yet detailed/built)

### Étudiant (student) side
- [ ] Phase 8 — `student-file-upload` — "Dépôt de fichier étudiant"
- [ ] Phase 9 — `student-messaging` + `add-to-calendar-modal` — "Messagerie étudiant-encadrant" (one route, modal overlay — same relationship as AddDeadline/DeadlineCalendar)

### Re-scoped out of Étudiant side
- [ ] `user-settings` ("Paramètres Utilisateur", `new_screen1.jsx`) — **mislabeled in this list**: the actual JSX is an ENCADRANT profile-editing screen (renders the encadrant `Sidebar`, "Encadrant vérifié" badge, academic institution/department/grade/specialties fields) — not a student screen at all. Likely a second, richer design draft for the same feature area as Phase 6's `SettingsPage.jsx`. Not built; needs a user decision (fold into Phase 6 settings as a "Profil" tab, or treat as a superseded draft) before any work happens here.

## Open design questions
Resolved 2026-08-03 — see `IMPLEMENTATION-PLAN.md` §6 for the 7 confirmed decisions (profileType field, cardinality, monetization kept, back-office kept, messaging = periodic refetch, calendar sync = decorative for MVP, profile choice fixed at signup).
- **New (2026-08-04)**: `new_screen1.jsx` ("Paramètres Utilisateur") mislabeling — see "Re-scoped out of Étudiant side" above. Not blocking Phase 7.

## Shared component inventory (from Banani `sharedFiles`)
- `/style.css` — theme tokens (see IMPLEMENTATION-PLAN.md § Design tokens)
- `Sidebar.jsx`, `StatCard.jsx`, `StudentRow.jsx`, `ActivityItem.jsx`, `AddStudentForm.jsx`, `FilterBar.jsx`, `AddDeadlineForm.jsx`, `SettingSection.jsx`, `DeadlineCard.jsx`, `CommentThread.jsx`, `SuccessMessage.jsx`, `StudentProfileSidebar.jsx`
- Global (Banani-provided, not custom): `Icon` (Lucide), `UserAvatar`
