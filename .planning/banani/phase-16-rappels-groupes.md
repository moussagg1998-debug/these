# Rappels groupés — Banani `new_screen8.jsx` ("Rappels groupés") → ThèseFacile

## Source
- Banani screen ID: `YQWElzV_9JrI/screens/new_screen8.jsx`
- Screen name: "Rappels groupés"
- Fetched: 2026-08-06
- Entry point: "Envoyer des rappels groupés" button on `/dashboard` (ENCADRANT), currently `disabled` with a "Bientôt disponible" tooltip (`frontend/src/app/dashboard/page.tsx:353-361`) — this phase makes it real.

## Structure map
- Top bar: back link → `/dashboard`, eyebrow "Mes étudiants", title "Envoyer des rappels groupés"
- Step 1 — Destinataires: checkbox list of the encadrant's students (avatar, urgency dot, name, topic, last submission), "Tout sélectionner"/"Désélectionner"
- Step 2 — Message: 4 template quick-picks (Standard/Urgent/Encouragement/Personnalisé), Objet (subject) input, Corps du message textarea with `{{prénom}}` placeholder note
- Step 3 — Canal d'envoi: Email institutionnel, Notification in-app, SMS (multi-select)
- Right panel: Récapitulatif (destinataires/canaux/modèle/envoi), "Planifier l'envoi" (decorative — see below), urgency info note, CTA "Envoyer les rappels" / "Annuler"

## Component breakdown
- **NEW** `frontend/src/app/students/reminders/page.tsx` — page shell, data + submit logic (ENCADRANT-only, same guard pattern as `/deadlines`, `/documents`)
- **NEW** `frontend/src/components/dashboard/ReminderRecipientRow.tsx` — one checkbox row (avatar, urgency dot, name/topic, last submission) — mirrors `StudentRow`'s data derivation but with a checkbox instead of an "Ouvrir" link
- **REUSE** `DashboardShell`, `Sidebar`, `Avatar`, `Icon` — same chrome as every other Encadrant page
- **REUSE** `useApi('/api/theses?limit=50')` for the recipient list — no new GET endpoint needed (`/api/theses` already returns `student`, `documents[0]`, `deadlines[0]` which is exactly what the row needs)
- **NEW** `POST /api/reminders` — top-level cross-thesis route (mirrors `/api/messages`, `/api/deadlines` — cross-thesis aggregates live top-level, not nested under `/api/theses/[id]`)
- **NEW** `frontend/src/lib/server/theses/reminder-email.ts` — HTML-escaping email template factory (mirrors `lib/server/auth/email-templates.ts`'s shape, not editing that file)
- **Icon.tsx**: add `arrow-left` (missing — needed for the back button; every other icon this screen uses already exists)

## Token mapping
Banani tokens for this screen are byte-identical to `frontend/src/app/globals.css`'s `@theme` block (same flow, already ported) — no new mapping needed, just Tailwind classes against existing `bg-background`/`text-primary`/etc.

## Backend design (the part Banani doesn't show)

**`POST /api/reminders`** — body `{ thesisIds: string[1..50], subject: string(1-200), body: string(1-5000), channels: { email: boolean, inApp: boolean } }` (at least one channel required).

For each thesis matching `{ id: in thesisIds, encadrantId: auth.user.sub }` (silently drops any id the encadrant doesn't own — same "don't leak" posture as `resolveThesisAccess`), **sequentially** (Neon `connection_limit=1` lesson from Phase 14 — no `Promise.all`):
1. Personalize `body`: replace `{{prénom}}` (accent-insensitive) with the student's first name (`displayName(student).split(' ')[0]`)
2. Create a real `Message` row (`thesisId`, `senderId=encadrant`, `body=personalized`) — reuses the existing Phase 1/9 messaging model instead of inventing a `Reminder` table. This means a bulk reminder **actually shows up** in the student's `/messages` thread, not just as an ephemeral notification.
3. If `channels.inApp`: `createNotification` (type `REMINDER`, `dedupeKey: reminder:${message.id}`), best-effort try/catch — same pattern as the existing per-thesis messages route
4. If `channels.email`: `getEmailQueue()?.enqueue({ to: student.email, subject, html, text })` directly — **no outbox needed**. I checked `email-queue-drain`'s cron route: it drains *any* pending `EmailJob` via `queue.drainOne()` regardless of who enqueued it, so calling the queue singleton directly from a normal route is exactly what the existing durable-retry infra already supports, without touching the protected `outbox/dispatcher.ts`. If the queue isn't configured (`null` — no Resend/Redis in this environment), skip with a `log.warn`, matching how every other optional provider degrades in this starter.

Response: `{ sent: number, recipients: [{ thesisId, studentId, studentName }] }`.

**No protected files touched.** (`outbox/dispatcher.ts`, `outbox/types.ts` untouched — deliberately avoided by going through `getEmailQueue()` directly instead of the outbox, since there's no other DB row that needs atomic-commit with the email here.)

## Responsive plan
- **Base (375px)**: single column — recipients list, message step, channel step, then summary panel stacked below (not a sidebar), full-width CTA buttons, back arrow + title wrap onto their own row if needed
- **md (768px)**: same single-column flow, wider paddings
- **lg (1024px+)**: Banani's two-column layout — left content (flex-1) + right 288px (`w-72`) summary sidebar, matching every other Encadrant page's `xl:flex-row` split convention (e.g. `/dashboard`'s "Activité récente" panel)
- Sidebar nav collapses to `DashboardShell`'s mobile drawer below `lg:`, same as every page

## Interactions / states
- Empty state: 0 students → "Aucun étudiant à contacter pour l'instant." + link back to `/students`
- Loading: skeleton-free "Chargement…" text, matching every other page's convention
- Selecting 0 recipients, empty subject/body, or 0 channels → CTA disabled (client-side), matching `AddDeadlineForm`'s submit-disabled convention
- Submit error → inline `role="alert"` message using `ApiError.code` switch, matching `AddDeadlineForm`
- Success → toast (`useToast`) + `router.push('/dashboard')` — no bespoke "SuccessMessage" screen, per the Phase 3 precedent (`ToastProvider` over a dedicated confirmation screen)
- Touch targets ≥48px on mobile for checkboxes/channel pills

## Copy (French, inline — this codebase has no i18n layer, strings live directly in JSX per every prior phase)
- 4 templates (Standard/Urgent/Encouragement/Personnalisé) — Standard reuses Banani's exact copy; Urgent/Encouragement are new copy in the same voice; Personnalisé clears the fields
- `{{prénom}}` helper text reused verbatim from Banani: "sera remplacé automatiquement par le prénom de chaque étudiant"
- Real encadrant name (from `/api/profile`) is substituted into the signature line client-side when a template is picked — not a second `{{}}` placeholder, since we already have it in hand

## Deliberate simplifications (flagging up front, same spirit as every prior phase doc)
- **SMS channel**: shown per Banani's design but rendered `disabled` with "Bientôt disponible" (no SMS provider exists anywhere in this codebase — matches the `AddDeadlineForm` reminder-checkbox and `/students/[id]` "Historique" tab precedent for showing-but-not-building an unimplemented affordance)
- **"Planifier l'envoi"**: rendered but `disabled`, locked to "Maintenant" — no scheduled-send infrastructure exists (matches Phase 9's dropped fake calendar-app selector reasoning). Sends are always immediate.
- **"Modèle" is a client-only convenience** — the server doesn't know or store which template was used, just the final subject/body text (same as how `AddDeadlineForm`'s priority buttons are pure client state before POST)

## Resolved decisions (user confirmed 2026-08-06)
1. **Default recipient selection**: all students pre-selected on load; encadrant opts out.
2. **Message is always real**: every send creates a real `Message` row in the thesis thread regardless of channel toggles — Email/In-app toggles only control the *additional* email/notification, not whether the student sees it in `/messages`.
3. **SMS + "Planifier l'envoi" removed from the UI entirely** (not shown-disabled) — only Email + Notification in-app channels are rendered; sends are always immediate, no schedule control at all. This is a deliberate, user-confirmed departure from the Banani mock (which shows SMS + a schedule dropdown) since neither has any backing infrastructure in this starter.

## Implementation checklist
- [ ] `Icon.tsx` — add `arrow-left`
- [ ] Backend: `POST /api/reminders` + tests
- [ ] `frontend/src/lib/server/theses/reminder-email.ts` + tests
- [ ] `ReminderRecipientRow` component
- [ ] `/students/reminders` page (mobile-first, then `lg:` two-column)
- [ ] Wire `/dashboard`'s "Envoyer des rappels groupés" button (remove `disabled`, add `Link` to `/students/reminders`)
- [ ] 375px / 768px / 1280px check
- [ ] format/lint/typecheck/test/build all green
- [ ] Update `STATUS.md`
