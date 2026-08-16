// Unit tests for the 3 rule-based anomaly checks — each asserts the exact
// threshold behavior documented in anomalies.ts's header comment.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import { detectAnomalies, countAnomalies } from './anomalies';

const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

// prisma.securityEvent.groupBy's conditional/overloaded generic signature
// defeats vitest-mock-extended's automatic Mock inference — cast to the
// minimal shape this file needs (same workaround as
// admin/institutions/route.test.ts's prisma.user.groupBy).
const mockGroupBy = prismaMock.securityEvent.groupBy as unknown as {
  mockResolvedValue: (value: unknown) => void;
  mockResolvedValueOnce: (value: unknown) => void;
};

beforeEach(() => {
  mockReset(prismaMock);
  vi.unstubAllEnvs();
  mockGroupBy.mockResolvedValue([]);
  prismaMock.securityEvent.findMany.mockResolvedValue([] as never);
  prismaMock.securityEvent.findFirst.mockResolvedValue(null);
});

describe('detectAnomalies — REPEATED_FAILED_LOGIN', () => {
  it('flags an email with >= threshold (default 5) failed logins in the last hour', async () => {
    mockGroupBy.mockResolvedValueOnce([{ email: 'victim@test.local', _count: { _all: 5 } }]);

    const flags = await detectAnomalies(prismaMock);

    expect(flags).toContainEqual(
      expect.objectContaining({
        kind: 'REPEATED_FAILED_LOGIN',
        email: 'victim@test.local',
        count: 5,
      }),
    );
  });

  it('does not flag an email below the threshold', async () => {
    mockGroupBy.mockResolvedValueOnce([{ email: 'victim@test.local', _count: { _all: 4 } }]);

    const flags = await detectAnomalies(prismaMock);
    expect(flags.some((f) => f.kind === 'REPEATED_FAILED_LOGIN')).toBe(false);
  });

  it('honors a configured SECURITY_FAILED_LOGIN_THRESHOLD', async () => {
    vi.stubEnv('SECURITY_FAILED_LOGIN_THRESHOLD', '2');
    mockGroupBy.mockResolvedValueOnce([{ email: 'victim@test.local', _count: { _all: 2 } }]);

    const flags = await detectAnomalies(prismaMock);
    expect(flags.some((f) => f.kind === 'REPEATED_FAILED_LOGIN')).toBe(true);
  });
});

describe('detectAnomalies — IP_SPRAY', () => {
  it('flags an IP with >= threshold (default 10) distinct emails failing in the last hour', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      ip: '203.0.113.9',
      email: `victim${i}@test.local`,
    }));
    prismaMock.securityEvent.findMany.mockResolvedValueOnce(rows as never);

    const flags = await detectAnomalies(prismaMock);
    expect(flags).toContainEqual(
      expect.objectContaining({ kind: 'IP_SPRAY', ip: '203.0.113.9', count: 10 }),
    );
  });

  it('does not double-count repeated failures against the SAME email from one IP', async () => {
    const rows = Array.from({ length: 20 }, () => ({
      ip: '203.0.113.9',
      email: 'same@test.local',
    }));
    prismaMock.securityEvent.findMany.mockResolvedValueOnce(rows as never);

    const flags = await detectAnomalies(prismaMock);
    expect(flags.some((f) => f.kind === 'IP_SPRAY')).toBe(false);
  });

  it('ignores rows with ip "unknown"', async () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      ip: 'unknown',
      email: `victim${i}@test.local`,
    }));
    prismaMock.securityEvent.findMany.mockResolvedValueOnce(rows as never);

    const flags = await detectAnomalies(prismaMock);
    expect(flags.some((f) => f.kind === 'IP_SPRAY')).toBe(false);
  });
});

describe('detectAnomalies — NEW_IP_ADMIN_LOGIN', () => {
  it('flags an admin LOGIN_SUCCESS from an IP never seen before for that user', async () => {
    prismaMock.securityEvent.findMany.mockImplementation((async (args: unknown) => {
      const a = args as { where?: { type?: unknown } };
      if (a.where && 'user' in (a.where as object)) {
        return [
          {
            id: 'se1',
            userId: 'admin_1',
            ip: '203.0.113.9',
            email: 'admin@test.local',
            createdAt: new Date(),
          },
        ];
      }
      return [];
    }) as never);
    prismaMock.securityEvent.findFirst.mockResolvedValueOnce(null); // no prior login from this IP

    const flags = await detectAnomalies(prismaMock);
    expect(flags).toContainEqual(
      expect.objectContaining({
        kind: 'NEW_IP_ADMIN_LOGIN',
        userId: 'admin_1',
        ip: '203.0.113.9',
      }),
    );
  });

  it('does not flag when the admin has logged in from this IP before', async () => {
    prismaMock.securityEvent.findMany.mockImplementation((async (args: unknown) => {
      const a = args as { where?: { type?: unknown } };
      if (a.where && 'user' in (a.where as object)) {
        return [
          {
            id: 'se1',
            userId: 'admin_1',
            ip: '203.0.113.9',
            email: 'admin@test.local',
            createdAt: new Date(),
          },
        ];
      }
      return [];
    }) as never);
    prismaMock.securityEvent.findFirst.mockResolvedValueOnce({ id: 'prior' } as never);

    const flags = await detectAnomalies(prismaMock);
    expect(flags.some((f) => f.kind === 'NEW_IP_ADMIN_LOGIN')).toBe(false);
  });
});

describe('countAnomalies', () => {
  it('returns the length of detectAnomalies', async () => {
    mockGroupBy.mockResolvedValueOnce([{ email: 'a@b.com', _count: { _all: 99 } }]);

    const count = await countAnomalies(prismaMock);
    expect(count).toBe(1);
  });
});
