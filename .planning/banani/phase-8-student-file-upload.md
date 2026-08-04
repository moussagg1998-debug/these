# Phase 8 — Dépôt de fichier étudiant — Banani → Next.js

## Source
- Banani screen: `StudentFileUpload.jsx` (referenced from `new_screen5.jsx`'s "Déposer un fichier" button, already wired as a real `Link` in Phase 7).
- Shares `StudentNav` with Phase 7 (no new shared components fetched).

## Routing decision — new nested route, no branching needed
`/documents` already exists and is ENCADRANT-only (Phase 4's "Bibliothèque de documents"). This screen lives at `/documents/new` — a sibling Next.js route under the same top-level segment, not a branch of the existing page. No collision: `app/documents/page.tsx` and `app/documents/new/page.tsx` are independent route files. Gated to ETUDIANT + must have a thesis; anything else redirects to `/dashboard` (mirrors the `/dashboard` empty-state precedent from Phase 7 rather than duplicating an empty-state UI here).

## System findings
- `POST /api/theses/[id]/documents` is already `STUDENT_ONLY`-gated and already notifies the encadrant (built Phase 1, confirmed working in Phase 7's investigation) — zero new backend needed for the deposit itself.
- Storage is Cloudinary via the existing `POST /api/upload` — two-step flow: upload the file first (get back `url`/`filename`/`sizeBytes`), then `POST` those into `/api/theses/[id]/documents`.
- **`api<T>()` (`frontend/src/lib/api.ts`, protected) cannot do this upload** — it unconditionally JSON-encodes any `body` and sets `Content-Type: application/json`, with no multipart/FormData path. Confirmed no existing caller anywhere in `frontend/src` or `examples/` does a multipart upload from the client — this is genuinely the first one. Rather than modify the protected file, added a small sibling helper (`frontend/src/lib/uploadFile.ts`) that duplicates just the ~6 lines of CSRF-token lookup (api.ts doesn't export `getCsrfToken`) and does a raw `fetch` with `FormData`. Documented inline why this can't just call `api()`.
- **MIME allowlist gap**: `UPLOAD_ALLOWED_MIME` defaults to image-only (`image/jpeg,image/png,image/webp`), pinned by an exact-string `.toContain` assertion in `frontend/src/lib/server/observability/env-shape.test.ts` against the repo-root `.env.example` (the actual shared/tested file — confirmed by reading the test's `ENV_EXAMPLE` path resolution; `frontend/.env.local` is a separate, gitignored, untracked local file that happens to currently mirror the same default for this dev machine). **Resolution**: do not touch `.env.example` or its pinning test — that's the generic starter's cross-fork contract (CLAUDE.md: this repo is genuinely the generic izikit starter with ThèseFacile layered on top). Instead extended the untracked `frontend/.env.local` locally with `application/pdf`, DOCX's, and ODT's MIME types, and documented below that **any real deployment of this fork must set `UPLOAD_ALLOWED_MIME` in its own environment** (Vercel project env vars, etc.) to include those three types — same "inert/misconfigured until the operator sets env" treatment CLAUDE.md already documents for `CLOUDINARY_*`/`GOOGLE_*`.
- **Sniffer gap**: `application/pdf` already has a magic-byte sniffer in `upload/sniff.ts` (fair-game file, not protected). DOCX and ODT had none — both are ZIP containers (`PK\x03\x04` signature) and are indistinguishable from a bare ZIP magic-byte check alone. Added format-specific sniffers that additionally scan the first 4KB for each format's near-universal fingerprint string: OOXML (`.docx`) writes `[Content_Types].xml` as an early zip entry; ODF (`.odt`) mandates `mimetype` be the *first*, uncompressed entry, whose content is the literal string `application/vnd.oasis.opendocument.text` immediately following. This is the same "detect renamed extensions, not a determined attacker" threat model as the existing sniffers — documented as such, with tests.
- **Cloudinary is not actually configured in this dev environment** (`frontend/.env.local` has empty `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`) — per CLAUDE.md's documented "optional providers boot conditionally" behavior, `/api/upload` currently returns `503 STORAGE_NOT_CONFIGURED` regardless of this phase's MIME work. The smoke test below verifies the route responds with the correct auth/CSRF/503 behavior, not a real successful upload (not possible without real credentials).

## Field-scope gaps found + resolution
- **Chapter selector** — Banani shows a fixed dropdown implying a set curriculum. No chapter catalog exists in the schema (`Document.chapter` is a free `String?`, same as every other phase). Built as a free-text input with a `<datalist>` of common suggestions ("Introduction", "Chapitre 1"… "Conclusion") for autocomplete convenience — honest (no fake enforced curriculum) while keeping Banani's quick-pick UX.
- **"Numéro de version" (v3) field** — no `version` column anywhere and no versioning concept in the schema (each deposit is just a new `Document` row). **Dropped** — no schema backing, nothing to attach it to.
- **"Notes (optionnel)" field** — no `Document.notes` column exists. Rather than add a new schema field for a single free-text note, reused the **already-fixed** `Comment.documentId` relation (Phase 7's bug fix): if the student fills in notes, a `Comment` is created via the existing `POST /api/theses/[id]/comments` (authored by the student, linked to the new document) right after the document POST succeeds. This is a real, working submission path through existing infrastructure, not a fabricated field. It also composes correctly with Phase 7's dashboard: `encadrantComments` there filters to `author.id === encadrant.id`, so a student's own note about their own submission correctly does NOT show up in "Retours de mon encadrant" (that panel is specifically encadrant feedback) — it will appear if the encadrant ever views a full per-document thread, which is out of scope for both this phase and Phase 7 (no such view exists yet either side).
- **"Chapitre actif" sidebar box** ("Chapitre 4 de 7", last-deposit date, status) — requires fabricating a chapter position/count that doesn't exist in the schema. **Dropped entirely** (not rendered inert — there's no control here, only data that would have to be invented, same distinction Phase 7 drew for the 8-step curriculum).
- **"Chronologie du chapitre"** mini-timeline with specific milestone dates — same fabrication problem. **Dropped entirely**, consistent with Phase 7's precedent for the encadrant/student dashboards.
- **"Dépôt immédiat" / "Programmer le dépôt" quick actions** — Banani shows these as two sidebar buttons duplicating the page's main submit action. Consolidated into one real primary submit button ("Déposer le document"); "Programmer le dépôt" (scheduled/deferred submission) has no backing infrastructure (would need a real job scheduler) — kept as a second, visibly disabled button with `title="Bientôt disponible"`, matching the inert-affordance pattern used throughout this port.
- **"Max 10 Mo — Formats: .docx, .pdf, .odt" copy** — kept verbatim; matches the real `UPLOAD_MAX_BYTES` default (10485760 = 10 MB) and the three MIME types now sniffable/allowed locally.

## Backend
- No new routes, no schema changes. Reuses `POST /api/upload` (Cloudinary) → `POST /api/theses/[id]/documents` → optionally `POST /api/theses/[id]/comments` (for notes), all pre-existing and already tested for this exact access pattern.
- `frontend/src/lib/server/upload/sniff.ts` — added `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX) and `application/vnd.oasis.opendocument.text` (ODT) sniffers + a shared `hasZipSignature` helper. New `sniff.test.ts` covers both (positive + negative cases) — this file previously had zero direct unit tests (only indirect coverage via `upload/route.test.ts`).
- `frontend/.env.local` (untracked, local-only) — `UPLOAD_ALLOWED_MIME` extended with the three document MIME types, for this dev machine's own `pnpm dev`/`pnpm test` runs. **Not** a change to `.env.example` (the shared, shape-tested starter contract) — see System findings above. Flagging here again as the one item a real deployment must replicate via its own env config.
- `frontend/prisma/schema.prisma` — fixed a stale comment on `Document.fileName`/`sizeBytes` that said "student upload is Phase 6" (accurate when written during Phase 4, superseded once the student-side work was re-scoped into Phases 7-9). No functional schema change.

## Component breakdown
- **NEW** `frontend/src/lib/uploadFile.ts` — `uploadFile(file: File): Promise<{id, url, filename, mimeType, sizeBytes}>`, the raw-`fetch`-based multipart helper (see System findings for why `api()` can't be reused).
- **NEW** `frontend/src/components/student/StudentFileUploadForm.tsx` — drag-and-drop zone + file picker, chapter input (with datalist), notes textarea, submit/schedule buttons, upload progress/error states. Owns the 2-3 step submission (`uploadFile` → `POST .../documents` → optional `POST .../comments`), toasts on success, redirects to `/dashboard`.
- **REUSE** `StudentNav` (Phase 7) as-is.

## Screens

### Dépôt de fichier étudiant → `/documents/new` (frontend/src/app/documents/new/page.tsx)
- Auth-gates on `profile.profileType === 'ETUDIANT'` and requires a thesis (`GET /api/theses` items[0]) — redirects to `/dashboard` otherwise (covers both "wrong role" and "no encadrant assigned yet", reusing the empty-state messaging already shown there rather than duplicating it).
- Drag-and-drop area accepts `.pdf`/`.docx`/`.odt` (client-side `accept` hint only — the server remains the real trust boundary via MIME allowlist + magic-byte sniff, same invariant as every other upload path in this starter).
- Chapter free-text input w/ datalist suggestions, notes textarea (optional).
- Primary "Déposer le document" button: `uploadFile()` → `POST /api/theses/{id}/documents` (with `chapter`, `fileName`, `sizeBytes`) → if notes non-empty, `POST /api/theses/{id}/comments` (`documentId` + `body`) → toast success → `router.push('/dashboard')`.
- Secondary "Programmer le dépôt" button: disabled, `title="Bientôt disponible"`.
- Error states: client-side size/type pre-check (mirrors server limits for UX, not security) surfaces inline; server errors (`STORAGE_NOT_CONFIGURED`, `FILE_TOO_LARGE`, `INVALID_MIME`, `MAGIC_BYTE_MISMATCH`, `INVALID_FILE_CONTENT`) map to French messages via the same `ERROR_MESSAGES` record pattern used by `AddDeadlineForm`/`AddStudentForm`.

## Responsive plan
`screenSize: desktop` in Banani, same as every prior phase.
- **Base (375px)**: single column — nav (Phase 7's already-responsive `StudentNav`), then dropzone, then form fields, buttons full-width.
- **lg (1024px+)**: Banani's two-column layout (form left, static tips/quick-actions right) — right column now only holds the two quick-action buttons (see Deliberate simplifications), so it's a light sidebar rather than Banani's data-heavy one.

## Deliberate simplifications (flagged, not silent)
- No "chapitre actif" position/count box, no chapter timeline — both would require fabricating data with no schema backing.
- No document "version" field/number.
- "Notes" become a real Comment linked to the document (reusing Phase 7's bug-fixed relation), not a new schema field.
- "Programmer le dépôt" stays inert (no scheduler infrastructure exists or is warranted for a v1).
- Chapter is free text with suggestions, not an enforced fixed curriculum.
- MIME allowlist is widened only in the local untracked `.env.local`, not in the shared `.env.example` contract — real deployments must set this themselves.

## Implementation checklist
- [x] `sniff.ts` DOCX/ODT sniffers + `sniff.test.ts`
- [x] `frontend/.env.local` MIME allowlist extended (local only)
- [x] `uploadFile.ts` helper
- [x] `StudentFileUploadForm` component
- [x] `/documents/new` page (auth-gated, empty-state redirect)
- [ ] 375/768/1280 check — **not verified**, same caveat as every prior phase, no browser tool in this session
- [x] `pnpm format && lint && typecheck && test(666/666) && build`
- [x] dev-server smoke check (curl 200 on `/documents/new`, `/dashboard`, `/settings`, `/deadlines`; 401 on unauthenticated `/api/theses`; 403 on unauthenticated `POST /api/upload`)
