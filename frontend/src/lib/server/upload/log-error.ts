/**
 * Upload error log — Admin → Gestion des documents. Call from
 * POST /api/upload's error branches to record a failed attempt:
 *
 *   await logUploadError(prisma, {
 *     code: 'FILE_TOO_LARGE',
 *     source: 'VALIDATION',
 *     userId: auth.user.sub,
 *     sizeBytes: file.size,
 *   });
 *
 * Best-effort by design (mirrors the outbox notification pattern elsewhere
 * in this codebase) — a logging failure must never change the response
 * already being returned to the caller. See lib/server/security/log-event.ts
 * for the sibling pattern this mirrors (self-service event, not an
 * admin-audited action).
 */
import type { PrismaClient } from '@prisma/client';

export type UploadErrorCode =
  | 'UPLOAD_MISSING_FILE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_MIME'
  | 'MAGIC_BYTE_MISMATCH'
  | 'HEIC_CONVERSION_FAILED'
  | 'STORAGE_NOT_CONFIGURED'
  | 'UPLOAD_FAILED';

export type UploadErrorSource = 'VALIDATION' | 'CLOUDINARY';

export interface UploadErrorInput {
  code: UploadErrorCode;
  source: UploadErrorSource;
  userId?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export type UploadErrorClient = Pick<PrismaClient, 'uploadErrorEvent'>;

export async function logUploadError(
  prisma: UploadErrorClient,
  input: UploadErrorInput,
): Promise<void> {
  await prisma.uploadErrorEvent.create({
    data: {
      code: input.code,
      source: input.source,
      userId: input.userId ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
    },
  });
}
