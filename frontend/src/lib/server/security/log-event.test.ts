// Companion unit test for security/log-event.ts::logSecurityEvent — mirrors
// admin/audit.test.ts's shape for logAdminAction.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import { logSecurityEvent } from './log-event';

const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => mockReset(prismaMock));

describe('logSecurityEvent', () => {
  it('writes a SecurityEvent row with all fields, lowercasing + trimming the email', async () => {
    prismaMock.securityEvent.create.mockResolvedValue({} as never);

    await logSecurityEvent(prismaMock, {
      type: 'LOGIN_SUCCESS',
      userId: 'user_1',
      email: '  User@Test.Local  ',
      ip: '203.0.113.5',
      userAgent: 'Mozilla/5.0',
      metadata: { reason: 'ok' },
    });

    expect(prismaMock.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'LOGIN_SUCCESS',
        userId: 'user_1',
        email: 'user@test.local',
        ip: '203.0.113.5',
        userAgent: 'Mozilla/5.0',
        metadata: { reason: 'ok' },
      }),
    });
  });

  it('defaults optional fields to null when omitted', async () => {
    prismaMock.securityEvent.create.mockResolvedValue({} as never);

    await logSecurityEvent(prismaMock, {
      type: 'LOGIN_FAILED',
      email: 'unknown@test.local',
    });

    const arg = prismaMock.securityEvent.create.mock.calls[0]?.[0];
    expect(arg?.data).toMatchObject({
      type: 'LOGIN_FAILED',
      userId: null,
      email: 'unknown@test.local',
      ip: null,
      userAgent: null,
      metadata: null,
    });
  });

  it('accepts a tx-shaped client (TransactionClient subset)', async () => {
    const securityEventCreate = vi.fn().mockResolvedValue({});
    const txMock = { securityEvent: { create: securityEventCreate } } as never;

    await logSecurityEvent(txMock, { type: 'PASSWORD_CHANGED', email: 'a@test.local' });

    expect(securityEventCreate).toHaveBeenCalledOnce();
  });
});
