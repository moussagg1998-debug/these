# Phase 7 — Dashboard Étudiant — Banani → Next.js

## Source
- Banani screen: `new_screen5.jsx`, `displayName: 'Dashboard Étudiant'`, `screenSize: desktop`.
- No shared components fetched for this screen — it's self-contained (own top nav, not `Sidebar`).

## Scope note — student side is bigger than one phase
STATUS.md's pending Étudiant list names 5 items. One of them, `user-settings` ("Paramètres Utilisateur", `new_screen1.jsx`), turns out on inspection to be **mislabeled**: its actual JSX renders the ENCADRANT `Sidebar` (`active="settings"`) and encadrant-specific data ("Pr. Amadou Diallo", "Encadrant vérifié", "Nombre max. d'étudiants", "Domaines de spécialité") — it is a second, richer profile-editing draft for the *encadrant* settings area, not a student screen at all. It's **excluded from student-side scope**; flagged here for the user to decide later (fold into Phase 6's settings as a "Profil" tab, or drop as a superseded design draft — not decided, not blocking).

The remaining 4 are genuinely student-facing and split into 3 phases (mirroring the Phase 3→6 cadence):
- **Phase 7 (this one)**: `dashboard-etudiant` — the foundational screen; almost every other student screen links back to it.
- **Phase 8**: `student-file-upload` — needs real Cloudinary MIME/sniffer additions (`application/pdf` is already sniffable; DOCX/ODT are not — found while reading `upload/sniff.ts`), so it's scoped separately.
- **Phase 9**: `student-messaging` + `add-to-calendar-modal` (one route — `AddMeetingToCalendar.jsx` is `StudentMessaging.jsx` + a modal overlay, same relationship as `AddDeadline.jsx`/`DeadlineCalendar.jsx`).

## Routing decision — reuse `/dashboard`, same branch pattern as Phase 6's `/settings`
`/dashboard` already branches: ENCADRANT sees the built dashboard; ETUDIANT currently sees a "Ce tableau de bord est réservé aux encadrants" placeholder (pre-Phase-3 stub). Replace that stub branch with the real `StudentDashboardContent`. No new route — same file, same pattern that already proved out in Phase 6.

## System findings — more backend already exists than expected
- `GET /api/theses` **already scopes by `studentId` when `profileType === 'ETUDIANT'`** (`frontend/src/app/api/theses/route.ts:53`) — the student-side read path was built in Phase 1 alongside the encadrant one, just never consumed by any UI. Per the MVP's one-thesis-per-student rule, this returns 0 or 1 item.
- `GET /api/theses/[id]/documents`, `GET/POST /api/theses/[id]/comments`, `GET /api/theses/[id]/deadlines` are all already dual-sided (`resolveThesisAccess` grants both parties read access) — built once in Phase 1, reused here for real for the first time.
- `POST /api/theses/[id]/documents` is **already student-only-gated** (`STUDENT_ONLY` if not the student) and already notifies the encadrant — Phase 8 needs zero new backend for the deposit itself, only the upload UI + Cloudinary MIME config.
- `GET /api/notifications/count` exists and returns `{count}` but **is not consumed by any page yet** — not even the encadrant's. Banani's student dashboard shows a bell+badge; wiring it here is a small, real addition (not fabricated), but it's worth noting this creates an asymmetry with the encadrant top bar (which has never shown a real bell either, across Phases 3–6). Not retrofitting the encadrant side in this phase — flagged, not silently expanded.

## Field-scope gaps found + resolution
- **8-step milestone pills** (Inscription/Introduction/Revue de littérature/.../Soutenance) — Banani hardcodes a fixed 8-item curriculum with per-item done/active flags. Nothing in the schema models sub-stage milestones (`Thesis.stage` is one of 5 coarse states; `Thesis.progress` is a plain 0–100 int). **Dropped** — replaced with the real `progress`% bar (already `Thesis.progress`, already used nowhere else visually but real) + the real `stage` badge (`STAGE_COLORS` from `lib/theses.ts`, the same badge used everywhere else in the app). No fake curriculum invented.
- **Document status pills** ("En cours de révision"/"Commenté"/"Validé") — no `Document.status` field and no signal for "validated" exists anywhere. Simplified to a **2-state real derivation**: a document with ≥1 linked comment (`Comment.documentId`) shows "Commenté"; otherwise "En attente de retour". Honest about dropping the third state rather than guessing at a "validated" signal that doesn't exist.
- **"Marquer comme résolu" from the student side** — Banani's *own* two screens disagree: the encadrant's Comments Overview (Phase 4) treats `resolved` as the encadrant's triage call (`PATCH /api/comments/[id]` is explicitly encadrant-only, by deliberate Phase 4 design — see that route's own comment), while this student screen's mock shows the student resolving directly. **Not overturning the shipped Phase 4 decision inside this phase** — the button renders on the student dashboard but **disabled**, "Réservé à votre encadrant" tooltip, consistent with the inert-affordance pattern used throughout this port. If the user wants student-side resolution later, that's a deliberate policy change to flag explicitly, not a silent side effect of building this screen.
- **"M2 — Sciences éco." student subtitle** in the top-nav avatar block — no academic-level/filière field exists on `User`. Dropped; the student's name renders alone.
- **Encadrant's "Maître de conférences" title** in the "Mon encadrant" card — no title/rank field on `User` either. Dropped; shows name + email only (already the same simplification used for encadrant identity everywhere else in the app).
- **Top nav "Documents"/"Commentaires"/"Calendrier" links** — Banani's own source renders these as plain `<a>` with no `href`/`onClick` in *every* screen that has this nav (not just this one) — they were never wired in the design itself. Since no dedicated student-side routes for these exist in STATUS.md's committed scope (unlike the encadrant Sidebar's Documents/Comments/Échéances, which do have real target pages), these stay inert text, not real links. "Mon mémoire" is the one real, active link (→ `/dashboard`).
- **"Année 2024–2025" header copy** — hardcoded, matches the exact same hardcoded string already used across every encadrant screen's top bar. Consistent, not a new simplification.

## Backend
- No new routes. Reuses `GET /api/theses`, `GET /api/theses/[id]/documents`, `GET /api/theses/[id]/comments`, `GET /api/theses/[id]/deadlines`, `GET /api/notifications/count` — all pre-existing, all already tested for the student-access path (or, for `/count`, generic and user-scoped regardless of profile type).
- `GET /api/theses/[id]/comments` extended: `include.author` now also selects `email` (needed by `displayName()`), and `include.document` now selects `{id, chapter}` (needed for the "chapitre" tag on each comment).
- **Bug found + fixed while extending the above**: `Comment.documentId` never had an actual Prisma `@relation` — it was a bare scalar column. `GET /api/comments/route.ts` (shipped in Phase 4, "Commentaires — Vue d'ensemble") already does `include: { document: {...} } }`, which TypeScript silently accepted (Prisma's generic argument-inference doesn't excess-property-check nested `include` objects the way a direct object-literal assignment would) but which would **throw at runtime against a real database** — Prisma has no such relation to resolve. Fully-mocked unit tests never exercised real Prisma validation, so this was never caught. Fixed by adding `Comment.document Document? @relation(...)` + `Document.comments Comment[]` — migration `20260804004938_thesefacile_comment_document_relation` (see Files Changed). This was a genuine, already-shipped production bug, not something introduced by this phase; fixing it was necessary anyway since the Phase 7 comment display needed the same relation.

## Component breakdown
- **NEW** `src/components/student/StudentNav.tsx` — the top nav shell (logo, 4 nav items — 1 real link + 3 inert — bell+real-count badge, avatar+name). Reused as-is by Phase 8/9.
- **NEW** `src/components/student/StudentDashboardContent.tsx` — the full dashboard body. Kept in its own file rather than inlined in `dashboard/page.tsx` (unlike Phase 6's `EncadrantSettingsContent`) purely because of size — this screen has ~9 data-driven sections across 4 API calls, meaningfully bigger than the settings screen.
- **NEW** `src/components/student/StudentDocumentRow.tsx` — simpler than the encadrant `DocumentRow` (no student-name/stage columns needed — it's already "my" documents).
- **NEW** `src/components/student/StudentCommentItem.tsx` — encadrant-authored comment display + disabled resolve button.
- **REUSE** `lib/theses.ts` helpers/types as-is: `ThesisListItem`, `ThesisPerson`, `STAGE_COLORS`, `displayName`, `formatDate`, `formatFileSize`, `documentDisplayName`, `documentFormat`, `daysUntil`, `relativeTime`.

## Screens

### Dashboard Étudiant → `/dashboard` (ETUDIANT branch, frontend/src/app/dashboard/page.tsx)
Fetches (all via `useApi`, gated on `profile.profileType === 'ETUDIANT'`): `GET /api/theses` (find "my" thesis, if any), then in parallel `GET /api/theses/{id}/documents`, `GET /api/theses/{id}/comments`, `GET /api/theses/{id}/deadlines`, and `GET /api/notifications/count`.
- **No-thesis empty state** (Banani never shows this — designed here per the skill's "empty states are part of the contract" rule): "Aucun encadrant ne vous a encore assigné de mémoire." No dashboard body renders.
- Header card: topic, stage badge, encadrant name, next deadline's due date (if any).
- Progress card: real `progress`% bar + `stage` badge (replacing the fake 8-step pills).
- Mes documents: real list, 2-state derived status, real "Déposer un fichier" button → `/documents/new` (Phase 8's future route — real link per the Sidebar-precedent, since Phase 8 is committed scope).
- Retours de mon encadrant: comments filtered to `author.id === thesis.encadrant.id`, disabled resolve button (see above).
- Right column: Prochaine échéance (next deadline or empty state), Dernier retour non lu (first unresolved encadrant comment, or hidden if none), Mon encadrant card ("Envoyer un message" → `/messages`, Phase 9's future route), Conseils (static copy, no data needed).

## Responsive plan
`screenSize: desktop` in Banani.
- **Base (375px)**: top nav collapses to logo + avatar only (3 middle nav items hidden below `md:`, matching the mobile-hides-secondary-nav pattern already used by `DashboardShell`'s hamburger — except this nav has no drawer since the 3 hidden items are inert text anyway, nothing of value to reach on mobile). Right sidebar stacks below the main column (`flex-col` → `lg:flex-row`).
- **lg (1024px+)**: Banani's fetched two-column layout.

## Deliberate simplifications (flagged, not silent)
- No 8-step milestone curriculum — real `progress`%/`stage` only.
- Document status is 2-state (Commenté / En attente de retour), not Banani's 3-state.
- Student-side comment resolution stays disabled — Phase 4's encadrant-only decision is not silently overturned.
- No academic-level or title/rank strings for either party — neither field exists.
- Notification bell is real here but still absent on the encadrant side (asymmetry flagged, not fixed in this phase).

## Implementation checklist
- [x] `StudentNav` component
- [x] `StudentDocumentRow`, `StudentCommentItem` components
- [x] `StudentDashboardContent` component (4 API calls, empty state, all sections)
- [x] Wire `/dashboard`'s ETUDIANT branch to the new content (replacing the placeholder)
- [ ] 375/768/1280 check — **not verified**, same caveat as every prior phase, no browser tool in this session
- [x] `pnpm format && lint && typecheck && test && build`
