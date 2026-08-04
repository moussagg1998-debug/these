# Phase 9 — Messagerie étudiant-encadrant + Ajout au calendrier — Banani → Next.js

## Source
- Banani screens: `StudentMessaging.jsx` ("Messagerie étudiant-encadrant") + `AddMeetingToCalendar.jsx` ("Ajout au calendrier — Modal") — same relationship as `AddDeadline.jsx`/`DeadlineCalendar.jsx` (a modal layered on a list/detail screen), fetched together.
- `AddMeetingToCalendar.jsx`'s "background content" is literally the same messaging screen blurred behind the modal overlay — confirms the modal opens from within the messaging screen (its "Prochaine réunion" sidebar card's "Ajouter au calendrier" link).

## Routing decision — new top-level route `/messages`
Already referenced as a real `Link` from Phase 7's `StudentDashboardContent` ("Envoyer un message" → `/messages`). New route, ETUDIANT-only, same auth/thesis gating pattern as Phase 8's `/documents/new` (redirect to `/dashboard` if wrong role or no thesis yet — avoids a third copy of the empty-state message).

## System findings — messaging backend already fully built, zero new routes needed
- `GET/POST /api/theses/[id]/messages` already exists (Phase 1), already dual-sided via `resolveThesisAccess`, already sends a `MESSAGE_RECEIVED` notification to the other party on POST. Confirmed by reading the route directly — no `sender` join in `GET`'s response (`{id, thesisId, senderId, body, createdAt}` only), so "is this message mine" is derived client-side (`senderId === user.id`) and the other party's identity comes from the already-fetched `GET /api/theses` thesis row (`thesis.encadrant`) — no backend change needed at all for the core chat.
- Confirmed in `IMPLEMENTATION-PLAN.md §6` (resolved design question, see STATUS.md): messaging is periodic-refetch, not real-time — no Ably wiring. Implemented here as a 5s `setInterval` calling `useApi`'s `refresh()` while the screen is mounted, cleared on unmount.
- **No symmetric encadrant-side UI.** Banani only designed the student-facing chat screen (same pattern already flagged for the notification bell in Phase 7) — the backend route works for both parties, but building an encadrant inbox view is out of scope here since there's no Banani source for it. Flagged, not silently expanded.
- **No `Meeting`/appointment model exists anywhere in the schema.** Banani's "Prochaine réunion" sidebar card and the calendar-export modal both assume a real scheduled meeting (specific date/time + office location) that doesn't exist as a concept in this app — the closest real thing is `Deadline` (`title`, `dueAt` as a full `DateTime`, `urgency`, optional `description`), which models document/chapter due dates, not face-to-face meetings. Resolution below.

## Field-scope gaps found + resolution
- **"Prochaine réunion" card (fake date/time + fabricated office location "Bureau, Bâtiment D — 3e étage")** — re-scoped to **"Prochaine échéance"**, reusing the thesis's real next `Deadline` (same data/label already used in Phase 7's dashboard sidebar) instead of inventing a meeting. No location shown (no such field exists) — honest about the gap rather than fabricating an address.
- **"Ajout au calendrier" modal** — re-scoped from "schedule a meeting" to **"export the next deadline to your personal calendar"**, which is genuinely buildable from real data (`Deadline.title` + `Deadline.dueAt`) with zero new backend:
  - Added `frontend/src/lib/ics.ts` — a small hand-rolled RFC 5545 `.ics` (iCalendar) generator (`buildIcs()` + `downloadIcs()`). No library needed — a VEVENT is ~10 plain-text lines. Produces a real, standards-compliant file any calendar app (Google/Outlook/Apple) can import, which matches what Banani's footer copy actually promises once reworded for accuracy (see below).
  - **"Ajouter à" calendar-app selector** (Banani: "Mon calendrier personnel" with a chevron, non-functional in the source) — **dropped**. A generic `.ics` download works identically regardless of which calendar app opens it; a fake per-app selector would add a decorative control with no real branching behind it. Building a *real* one would mean OAuth-integrating Google/Outlook Calendar APIs — a genuinely new, large scope addition with no sign-in-scope support today (`arctic`'s Google integration here is sign-in-only, not Calendar-scoped) — well beyond this phase.
  - **"Notification" (reminder) selector** — kept, and made **real**: a `<select>` (15 min / 30 min / 1 h / 1 jour avant) embeds a `VALARM` block in the generated `.ics`, a real RFC 5545 feature.
  - **"Notes (optionnel)"** — kept, maps to the `.ics` `DESCRIPTION` field, pre-filled from `Deadline.description` when present.
  - **Footer copy** — Banani says the event "sera synchronisé avec vos applications calendrier" (implies live sync). Reworded to "Le fichier téléchargé (.ics) peut être importé dans Google Calendar, Outlook, Apple Calendar, etc." — accurate to a one-time file download, not a live sync integration that doesn't exist.
  - If there's no upcoming deadline, the "Ajouter au calendrier" affordance is hidden (nothing to export) rather than opening an empty/fake modal.
- **"Horaires de disponibilité" sidebar box** (Mon–Fri 9h–18h, Sat 10h–13h, Sun closed) — fully fabricated, no `availabilityHours` concept anywhere in the schema. **Dropped entirely**, consistent with Phase 7/8's "no data = no box" precedent (not rendered inert — there's no control here, only invented data).
- **Encadrant "Maître de conférences" title, "Université de Dakar, UCAD" institution, phone number** in the profile card — same simplification already applied to every encadrant identity card since Phase 3 (no title/rank field, no phone field anywhere in the auth model). Shows name + email only, matching Phase 7's "Mon encadrant" card exactly.
- **"Actif il y a 1 h" presence status** in the chat header — no presence/last-seen tracking exists. Dropped; shows the encadrant's email under their name instead (same substitution used elsewhere for dropped fabricated subtitles).
- **"Fichiers récents" sidebar box** — Banani's two example filenames are static mock data, but this maps cleanly onto real data: the thesis's own `GET /api/theses/[id]/documents` (already fetched elsewhere), showing the 2 most recent real documents with real download links (`fileUrl`) via the existing `documentDisplayName`/`documentFormat` helpers. Made real rather than dropped, since the underlying data already exists and is already fetched by sibling screens.
- **"Désactiver les notifications" (mute this thread) / "Signaler" (report)** — no per-thread mute exists (Phase 6's notification prefs are global, not per-thesis) and no moderation/reporting feature exists. Both rendered as disabled buttons with `title="Bientôt disponible"`, the established inert-affordance pattern.
- **Paperclip / phone / info icons** (attachment upload, voice call, info drill-down) — no message-attachment field on `Message`, no calling feature, no additional info beyond what the sidebar already shows. All three rendered inert with the same tooltip treatment.
- **Top nav** — Banani's own `StudentMessaging.jsx` highlights "Commentaires" as `active` in its nav, not a "Messages" tab — there is no "Messages" label in the shared nav across *any* Banani student screen (same nav copy-pasted verbatim everywhere, as already documented in Phase 7's `StudentNav.tsx`). Reused `StudentNav` completely as-is, with no `active` highlight for this screen (highlighting "Commentaires" here would mislead — this isn't the comments screen).

## Backend
- No new routes, no schema changes. Reuses `GET/POST /api/theses/[id]/messages` (Phase 1), `GET /api/theses/[id]/deadlines` (Phase 5), `GET /api/theses/[id]/documents` (Phase 1), `GET /api/theses` (Phase 1) — all already tested for this exact access pattern.
- `.ics` generation is entirely client-side (no sensitive data, no persistence) — `frontend/src/lib/ics.ts`, new unit tests in `ics.test.ts`.

## Component breakdown
- **NEW** `frontend/src/lib/ics.ts` — `buildIcs(input): string`, `downloadIcs(filename, content): void`.
- **NEW** `frontend/src/components/student/AddToCalendarModal.tsx` — reminder select, notes textarea, download button; takes a `ThesisDeadline` prop.
- **NEW** `frontend/src/components/student/StudentMessagingContent.tsx` — chat panel (header, scrolling message list, composer) + right sidebar (encadrant profile, prochaine échéance + calendar export, fichiers récents, inert options). Owns the polling interval.
- **REUSE** `StudentNav` (Phase 7), `lib/theses.ts` helpers (`displayName`, `formatDate`, `documentDisplayName`, `documentFormat`) as-is.
- `frontend/src/components/ui/Icon.tsx` — added `paperclip`, `phone`, `calendar-plus`, `bell-off`, `flag` (all inert-affordance icons for this screen).

## Screens

### Messagerie étudiant-encadrant → `/messages` (frontend/src/app/messages/page.tsx)
- Same auth/thesis gating as `/documents/new` (ETUDIANT + has thesis, else redirect `/dashboard`).
- Left: conversation panel — header (encadrant avatar/name/email, inert phone/info icons), scrollable message list (own messages right-aligned/primary-colored, other party left-aligned/muted), composer (text input, inert paperclip, real send button — Enter submits).
- Right sidebar: encadrant profile card (name/email only), "Prochaine échéance" card (real next deadline, "Ajouter au calendrier" opens `AddToCalendarModal` when a deadline exists), "Fichiers récents" (2 most recent real documents), inert options (mute/report).
- Polls `GET /api/theses/{id}/messages` every 5s via `useApi`'s `refresh()` while mounted.

## Responsive plan
`screenSize: desktop` in Banani, same as every prior phase.
- **Base (375px)**: single column — chat panel full-width and full-height-ish, sidebar stacks below.
- **lg (1024px+)**: Banani's two-column layout (chat + fixed-width sidebar).

## Deliberate simplifications (flagged, not silent)
- No real scheduled-meeting concept — "Prochaine réunion" re-scoped to the thesis's real next `Deadline`, no fabricated location.
- Calendar export is a real, generic `.ics` download (with a working reminder/notes), not a live Google/Outlook API sync — no calendar OAuth scope exists.
- No per-thread mute, no reporting/moderation feature.
- No encadrant-side messaging UI — Banani didn't design one, backend already supports it if built later.
- No message attachments, no call feature, no presence/last-seen status.

## Implementation checklist
- [x] `Icon.tsx`: `paperclip`, `phone`, `calendar-plus`, `bell-off`, `flag`
- [x] `ics.ts` + `ics.test.ts`
- [x] `AddToCalendarModal` component
- [x] `StudentMessagingContent` component (chat + polling + sidebar)
- [x] `/messages` page (auth-gated, empty-state redirect)
- [ ] 375/768/1280 check — **not verified**, same caveat as every prior phase, no browser tool in this session
- [x] `pnpm format && lint && typecheck && test(673/673) && build`
- [x] dev-server smoke check (curl 200 on `/messages`, `/documents/new`, `/dashboard`; 401 on unauthenticated `/api/theses`)
