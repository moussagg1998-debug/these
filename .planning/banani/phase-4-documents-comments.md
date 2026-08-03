# Phase 4 — Documents & Commentaires — Banani → Next.js

## Source
- Banani flow: ThèseFacile (`YQWElzV_9JrI`).
- Screens: `DocumentsLibrary.jsx` ("Bibliothèque de documents"), `CommentsOverview.jsx` ("Commentaires — Vue d'ensemble").
- Shared component: `CommentThread.jsx` (priority left-border, resolved status dot, reply count).

## Why these are a bigger backend lift than Phase 3
Both screens are **cross-thesis aggregates** — "every document/comment across all of my students" — not scoped to one thesis like everything built in Phase 1/3. The existing `GET /api/theses/[id]/documents` and `.../comments` only return one thesis's rows. Two new top-level routes are needed rather than reusing the nested ones.

## Schema gaps found + resolution
- **`Document` has no filename/size.** Banani's table needs "Nom du fichier" and "Taille" columns; the model only has `fileUrl`/`chapter`/`uploadedAt`. Added `fileName String?` and `sizeBytes Int?` (both optional — Cloudinary's upload response already returns `original_filename`/`bytes`, so Phase 6's student-upload flow can populate them for real; today nothing creates documents yet, so display falls back to a filename derived from `chapter` or the `fileUrl` basename, and omits the size cell when `sizeBytes` is null). "Format" is derived from the extension, not stored — mirrors Banani's own `type: 'docx'/'pdf'` which was clearly derived the same way.
- **`Comment` has no resolved/priority.** Flagged back in Phase 3's plan as "Phase 4 territory" — now is that phase. Added `resolved Boolean @default(false)` and `priority String @default("medium")` ("low"|"medium"|"high"). `priority` is an optional field on `POST /api/theses/[id]/comments` (either side can set it, defaults to medium — Banani's composer UI never shows a priority picker, so this is set programmatically or left default in practice). `resolved` is only flippable by the encadrant (see below) — matches the product framing of "resolved" as an encadrant call on their own feedback thread.
- **No target for "Non lus" (unread).** Unread is inherently viewer-relative and would need a read-receipt model (who has seen which comment) — real scope, not a one-field add. Rendered as an inert tab (`disabled`, "Bientôt disponible") alongside the 3 working filters, same pattern as Terms' PDF button and StudentDetail's Documents/Historique tabs in Phase 3.

## New backend routes
- `GET /api/documents` — encadrant-only, cursor-paginated, `?studentId=`/`?type=` filters. Joins `thesis.student`/`thesis.stage` per row (mirrors the `include` shape already used in `GET /api/theses`).
- `GET /api/comments` — encadrant-only, cursor-paginated, `?resolved=true|false`/`?priority=` filters, top-level comments only (`parentId: null`) with `_count.replies` for the reply-count badge, `author`/`document`/`thesis` included.
- `PATCH /api/comments/[id]` — encadrant-only (`access.encadrantId !== auth.user.sub` → 403 `ENCADRANT_ONLY`, reusing `resolveThesisAccess`), body `{ resolved: boolean }`. Top-level (not nested under `/api/theses/[id]`) because the Comments Overview page works across theses and shouldn't need to know which thesis a comment belongs to just to resolve it.
- `POST /api/theses/[id]/documents` extended with optional `fileName`/`sizeBytes`.
- `POST /api/theses/[id]/comments` extended with optional `priority`.

## Component breakdown
- **NEW** `src/components/dashboard/DocumentRow.tsx` — port of Banani's inline row markup (it wasn't a separate shared component in the Banani fetch, just inlined in `DocumentsLibraryScreen` — extracted here since the project already has a "one row = one component" convention from `StudentRow`).
- **NEW** `src/components/dashboard/CommentThread.tsx` — direct port, wired to real props + a click handler that calls `PATCH /api/comments/[id]` to toggle resolved (Banani's status dot is inert in the mock; making it clickable is the obvious real behavior for an "overview" screen whose entire job is triaging open feedback).
- **REUSE** `DashboardShell`, `Sidebar` (already have `/documents`/`/comments` nav entries from Phase 3), `Avatar`, `Icon`.

## Screens

### Bibliothèque de documents → `/documents` (frontend/src/app/documents/page.tsx)
Client component, ENCADRANT-gated (same guard pattern as `/dashboard`/`/students`). Fetches `GET /api/documents`. Filter dropdowns: "Tous les étudiants" (populated from the encadrant's real student list via `/api/theses`), "Tous les types" (docx/pdf/pptx — derived, not stored), "Tous les mois" (client-side filter on `uploadedAt`). Accepts a `?studentId=` query param so `/students/[id]`'s Documents tab can deep-link to a pre-filtered view.

### Commentaires — Vue d'ensemble → `/comments` (frontend/src/app/comments/page.tsx)
Client component, ENCADRANT-gated. Fetches `GET /api/comments`. Filter tabs: "En cours" (resolved=false, default), "Résolus" (resolved=true), "Priorité haute" (priority=high), "Non lus" (inert). Accepts `?studentId=` the same way. Each `CommentThread` links to `/students/[thesisId]` (the parent thesis) so clicking through goes somewhere real, since Banani's own `<a>` wrapper had no href.

### StudentDetail tab wiring (frontend/src/app/students/[id]/page.tsx)
"Documents" and "Commentaires" tabs — previously inert placeholders (Phase 3) — now link to `/documents?studentId=<thesis.studentId>` and `/comments?studentId=<thesis.studentId>`. "Historique" stays inert; no Banani source exists for its content.

## Responsive plan
Both screens are `screenSize: 'desktop'` in Banani, same treatment as every prior phase.
- **Base (375px)**: filter dropdown row wraps/scrolls horizontally (`overflow-x-auto`, same pattern as `FilterBar`). Document table rows collapse to stacked cards below `lg:`, same technique as `StudentRow` (fixed-width flex columns don't survive 375px). `CommentThread` is already a flexible card (avatar + text stack), needs no structural change — the header row's `justify-between` (name/chapter vs. status dot) may need to wrap on very narrow screens (`flex-wrap`).
- **lg (1024px+)**: Banani's fetched desktop layout — full table with column headers, thread cards at full width in the content column.

## Deliberate simplifications (flagged, not silent)
- Document "Taille"/"Nom du fichier" are best-effort until Phase 6 wires real uploads with Cloudinary metadata.
- "Non lus" filter is inert — no read-receipt model exists or is planned for MVP.
- "Rechercher un document…" / "Chercher un commentaire…" search boxes stay decorative (same treatment as the dashboard/students search boxes since Phase 3 — Banani's own mock has no wiring behind them either).

## Implementation checklist
- [ ] Schema: `Document.fileName`/`sizeBytes`, `Comment.resolved`/`priority` + migration
- [ ] `GET /api/documents`, `GET /api/comments`, `PATCH /api/comments/[id]` + tests
- [ ] Extend `POST /api/theses/[id]/documents` and `.../comments` + tests
- [ ] `DocumentRow`, `CommentThread` components
- [ ] `/documents`, `/comments` pages
- [ ] Wire StudentDetail tab links
- [ ] 375/768/1280 check — same caveat as every prior phase, no browser tool in this session
- [ ] `pnpm format && lint && typecheck && test && build`
