# Phase 11 — Messagerie côté encadrant — Banani → Next.js

## Source
- Banani screen: `new_screen7.jsx`, `displayName: 'Messagerie — Côté Encadrant'` — the encadrant mirror of Phase 9's `StudentMessaging.jsx`, fetched after the Banani MCP was reconnected mid-session (user re-ran `claude mcp add`, user-level config).
- 3-column inbox: conversation list (multi-student) → active thread → "Contexte étudiant" right panel. Uses its own top nav in the mock (Tableau de bord/Mes étudiants/Documents/Messages/Calendrier) — **not** the `Sidebar` left-nav chrome every other encadrant screen uses.

## Routing decision — reuse `/messages`, same profileType-branch pattern as Phases 6/7
`/messages` already exists (Phase 9, ETUDIANT-only). Extends the same branch pattern used for `/settings` (Phase 6) and `/dashboard` (Phase 7): `profileType === 'ETUDIANT'` → existing `StudentMessagingContent` (untouched), `ENCADRANT` → new `EncadrantMessagingContent`. No new route.
**Chrome decision**: wrapped in the existing `DashboardShell`/`Sidebar` (matching Dashboard/Students/Documents/Comments/Deadlines/Settings) instead of Banani's one-off top nav for this screen — consistency across the encadrant back-office beats fidelity to a mockup that itself doesn't match its own sibling screens. `Sidebar.tsx`'s `NAV_ITEMS` gains a real "Messages" entry (its own header comment already establishes the precedent: real links even before/as a page is built, a 404 mid-build beats a fake-disabled link — this one isn't even mid-build, it's shipping now).

## System findings
- **No cross-thesis messages aggregate existed** — Phases 4-5 built exactly this shape for documents/comments/deadlines (`GET /api/documents`, `GET /api/comments`, `GET /api/deadlines`, all encadrant-only, one row per thesis or per item across all of an encadrant's students) but messaging never got its equivalent since only the per-thesis `GET/POST /api/theses/[id]/messages` existed (built Phase 1 for the *student* thread view, which only ever needs one thesis at a time). Added `GET /api/messages` to complete the same pattern already established 3 times.
- **Per-conversation unread count has no dedicated field** — reused the *existing* `MESSAGE_RECEIVED` notifications (already created by `POST /api/theses/[id]/messages` since Phase 1, `data: {thesisId, messageId}`) rather than adding a `Message.readAt` column: one query pulls all of the encadrant's unread `MESSAGE_RECEIVED` notifications, grouped by `data.thesisId` in application code. Real, no new schema, and it composes for free with the existing mark-as-read endpoint (`PATCH /api/notifications`) — opening a conversation with unread messages marks those specific notification ids read via the pre-existing route.
- **"Chapitre actif"** — no such field (same gap Phase 7/9 already found for the student side). Derived the same way Phase 9 already established for "last activity": the most recent document's `chapter`, sourced from the same `documents: {take: 2}` include already needed for "Derniers documents" — one extra field read, not a new concept.
- **`AddToCalendarModal` (Phase 9) is reused as-is** for both of Banani's "Planifier une réunion" entry points (conversation header + right-panel "Actions rapides") — it already takes a generic `ThesisDeadline` prop and isn't ETUDIANT-specific in its implementation, just re-scoped (Phase 9) from "schedule a meeting" to "export the next real Deadline as `.ics`". No changes needed to that component.

## Field-scope gaps found + resolution
- **Conversation list "last message preview" + relative time** — real, sourced from `GET /api/messages`'s per-thesis `messages: {take: 1}` include (same `take:1` idiom the theses-list route already uses for documents/deadlines).
- **Search box** — unlike the decorative search boxes on `/dashboard`/`/students` (no backend, no real filtering target), this one filters an already-fully-loaded, small, client-side list (an encadrant's own student count). Made **real**: client-side substring filter on student name + thesis topic.
- **"M2 Sciences éco." academic-level subtitle, "Active il y a 2 h" presence** in the conversation header — same fabrication gaps already established and dropped in Phase 7/9 (no academic-level field, no presence/last-seen tracking). Replaced with the student's real email, matching Phase 9's identical substitution.
- **"📎 Joindre un fichier" composer quick-action** — no `Message.attachmentUrl` field, no attachment upload wired into messages. Inert, `title="Bientôt disponible"` — matches Phase 9's identical treatment on the student composer.
- **"📅 Proposer un rendez-vous" / "✓ Valider un chapitre" composer quick-actions** — distinct from the header's "Planifier une réunion" (which is a real `.ics` export). These two are lighter free-text nudges with no backend concept of their own ("proposing availability" and "validating a chapter" aren't modeled anywhere — Document has no `validated` state, same gap Phase 7 already found and declined to fabricate). Resolved as **real quick-inserts**: clicking either pre-fills the message composer with a French template (the chapter one interpolates the real derived "chapitre actif" when known) that the encadrant can edit and send through the actual `POST /api/theses/[id]/messages` — genuinely functional, nothing invented on the backend.
- **"Voir les documents" / "Ajouter un commentaire" / "Voir le profil complet"** — real links to the already-existing `/documents?studentId=`, `/comments?studentId=` (Phase 4's established filter pattern, confirmed by reading `/api/documents`'s `studentId` query param — filters `Thesis.studentId`, the student's user id) and `/students/{thesisId}` (confirmed `/students/[id]` is keyed by thesis id, not student id, by reading `StudentRow`'s link + the backing `/api/theses/[id]` route).

## Backend
- **NEW** `GET /api/messages` (encadrant-only) — one row per thesis: `{ thesis: {id, topic, progress, student}, lastMessage, unreadCount, unreadNotificationIds, nextDeadline, recentDocuments }`. Single `thesis.findMany` with `include` (student, `messages: take 1`, `deadlines: take 1` future-only, `documents: take 2`) + one `notification.findMany` grouped client-side by `data.thesisId` — no N+1. `take: 200`, no cursor pagination, same precedent as `GET /api/deadlines` (Phase 5) — an encadrant's thesis count is bounded, unlike per-message volume.
- No changes to `GET/POST /api/theses/[id]/messages` (Phase 1) or `PATCH /api/notifications` (Phase 2) — both reused exactly as they are.

## Component breakdown
- **NEW** `frontend/src/components/dashboard/EncadrantMessagingContent.tsx` — conversation list (search-filtered), active thread (polls every 5s, same idiom as Phase 9), composer with 3 quick-actions, right "Contexte étudiant" panel.
- **REUSE** `AddToCalendarModal` (Phase 9) unchanged.
- `frontend/src/components/dashboard/Sidebar.tsx` — `NAV_ITEMS` gains `{ href: '/messages', icon: 'message-circle', label: 'Messages' }`.
- `frontend/src/components/ui/Icon.tsx` — added `more-horizontal`.

## Screens

### Messagerie — Côté Encadrant → `/messages` (ENCADRANT branch, frontend/src/app/messages/page.tsx)
- `DashboardShell` chrome (not Banani's own top nav — see routing decision above).
- Left: conversation list, sorted by most-recent activity (`lastMessage.createdAt` desc, nulls last), unread badges, live search filter.
- Center: active thread (header with real student identity + "Voir les documents"/"Planifier une réunion" actions, scrolling messages, 3-quick-action composer).
- Right: real progress bar, derived "chapitre actif", real next deadline, real 2 most recent documents, "Actions rapides" (Ajouter un commentaire / Planifier une réunion / Voir le profil complet — all real links/actions).
- Opening a conversation with unread messages marks the corresponding notifications read.
- Empty state (no students yet): matches the existing `/dashboard`/`/students` empty-state copy ("Aucun étudiant pour l'instant…") rather than inventing new copy for a third empty state of the same underlying condition.

## Responsive plan
`screenSize: desktop` in Banani (3-column inbox layouts are inherently desktop-shaped).
- **Base (375px)**: single column — conversation list OR active thread, never both (mobile shows the list first; selecting a conversation swaps to the thread view with a back affordance), right context panel collapses below the thread.
- **lg (1024px+)**: Banani's 3-column layout.

## Deliberate simplifications (flagged, not silent)
- No message attachments (composer paperclip stays inert).
- "Chapitre actif" is a derived proxy (latest document's chapter), not a modeled concept.
- "Proposer un rendez-vous"/"Valider un chapitre" are text-template inserts, not new backend actions.
- No encadrant-side unread badge on the Sidebar's "Messages" nav item itself (would require an extra fetch on every encadrant page load) — only the in-screen conversation-list badges are real.
- `GET /api/messages`'s unread-notification query is a fresh internal query (doesn't reuse `GET /api/notifications`'s route or its `MAX_LIMIT=50`), capped at `take: 500` as a safety net against an unbounded scan rather than true pagination — effectively unbounded for realistic v1 usage (an encadrant's unread-message volume across their students), same spirit as Phase 3's "pending comments" approximation.

## Implementation checklist
- [x] `GET /api/messages` + tests
- [x] `Sidebar.tsx` "Messages" nav item
- [x] `Icon.tsx`: `more-horizontal`
- [x] `EncadrantMessagingContent` component
- [x] `/messages/page.tsx` ENCADRANT branch
- [x] 375/768/1280 check — code-based audit only (no browser tool this session). The new component's mobile/desktop toggle uses a `mobileView` state (JS-driven, not pure CSS breakpoint stacking, since it's a 2-pane swap on mobile rather than a stack) — traced both branches of the ternary for both panes and confirmed both are always visible at `lg:`+ regardless of `mobileView`, and exactly one is visible below `lg:`. Every other class follows the same audited patterns as Phase 10 (base unprefixed, `sm:`/`lg:`/`xl:` overrides). Not a substitute for real visual verification.
- [x] `pnpm format && lint && typecheck && test(686/686) && build`
- [x] dev-server smoke check (curl 200 on `/messages`, `/dashboard`, `/settings`, `/students`; 401 on unauthenticated `/api/messages` + `/api/theses`)
