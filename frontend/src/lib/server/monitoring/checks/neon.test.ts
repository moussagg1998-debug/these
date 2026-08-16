import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect } from 'vitest';
import { checkNeon } from './neon';

describe('checkNeon', () => {
  it('ok=true when both the raw connectivity probe and a real model query succeed', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }] as never);
    prismaMock.user.count.mockResolvedValue(42);

    const result = await checkNeon();
    expect(result.ok).toBe(true);
    expect(result.unverified).toBeUndefined();
  });

  it('ok=false when the connection throws', async () => {
    prismaMock.$queryRawUnsafe.mockRejectedValue(new Error("Can't reach database server"));

    const result = await checkNeon();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Can't reach database server");
  });

  it('ok=false when raw SQL succeeds but a real model query fails (e.g. bad migration state)', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }] as never);
    prismaMock.user.count.mockRejectedValue(new Error('relation "User" does not exist'));

    const result = await checkNeon();
    expect(result.ok).toBe(false);
  });

  it('never reports unverified — the DB is a required dependency, not an optional provider', async () => {
    prismaMock.$queryRawUnsafe.mockRejectedValue(new Error('down'));
    const result = await checkNeon();
    expect(result.unverified).toBeUndefined();
  });
});
