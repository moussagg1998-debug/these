// Multipart file upload — `api()` (lib/api.ts, protected) always JSON-encodes
// its `body` and sets Content-Type: application/json unconditionally, so it
// cannot POST a FormData payload. This is the first client-side upload
// caller in the app (see .planning/banani/phase-8-student-file-upload.md),
// so rather than modify the protected wrapper this duplicates the small
// CSRF-token lookup it doesn't export and does a raw `fetch` instead.
import { ApiError, BACKEND_URL } from './api';
import { COOKIE_PREFIX } from './constants';

const CSRF_COOKIE_NAME = `${COOKIE_PREFIX}-csrf`;
const CSRF_STORAGE_KEY = `${COOKIE_PREFIX}-csrf`;

function getCsrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromStorage = localStorage.getItem(CSRF_STORAGE_KEY);
  if (fromStorage) return fromStorage;
  const escaped = CSRF_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

export interface UploadedFile {
  id: string;
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);

  const csrfToken = getCsrfToken();
  const res = await fetch(`${BACKEND_URL}/api/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
    body: form,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message : `Error ${res.status}`;
    // /api/upload returns { code, message } (not { error, message } like every
    // other route) — ApiError.code reads body.error, so remap here to keep
    // the ERROR_MESSAGES[err.code] pattern used by every other form working.
    throw new ApiError(res.status, message, { error: body.code, ...body });
  }

  return res.json() as Promise<UploadedFile>;
}
