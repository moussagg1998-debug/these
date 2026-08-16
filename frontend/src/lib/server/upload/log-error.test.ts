// Companion unit test for upload/log-error.ts::logUploadError — mirrors
// security/log-event.test.ts's shape for logSecurityEvent.
import { describe, it, expect, beforeEach } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import { logUploadError } from './log-error';

const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => mockReset(prismaMock));

describe('logUploadError', () => {
  it('writes an UploadErrorEvent row with all fields', async () => {
    prismaMock.uploadErrorEvent.create.mockResolvedValue({} as never);

    await logUploadError(prismaMock, {
      code: 'FILE_TOO_LARGE',
      source: 'VALIDATION',
      userId: 'user_1',
      mimeType: 'image/jpeg',
      sizeBytes: 999,
    });

    expect(prismaMock.uploadErrorEvent.create).toHaveBeenCalledWith({
      data: {
        code: 'FILE_TOO_LARGE',
        source: 'VALIDATION',
        userId: 'user_1',
        mimeType: 'image/jpeg',
        sizeBytes: 999,
      },
    });
  });

  it('defaults optional fields to null when omitted', async () => {
    prismaMock.uploadErrorEvent.create.mockResolvedValue({} as never);

    await logUploadError(prismaMock, { code: 'UPLOAD_FAILED', source: 'CLOUDINARY' });

    expect(prismaMock.uploadErrorEvent.create).toHaveBeenCalledWith({
      data: {
        code: 'UPLOAD_FAILED',
        source: 'CLOUDINARY',
        userId: null,
        mimeType: null,
        sizeBytes: null,
      },
    });
  });
});
