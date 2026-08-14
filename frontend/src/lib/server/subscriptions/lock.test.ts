import { describe, it, expect, vi } from 'vitest';
import { lockCouponTx } from './lock';

describe('lockCouponTx', () => {
  it('takes an advisory lock namespaced "coupon:{code}"', async () => {
    const executeRawUnsafe = vi.fn().mockResolvedValue(0);
    const tx = { $executeRawUnsafe: executeRawUnsafe };
    await lockCouponTx(tx as never, 'THESIS');
    expect(executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'coupon:THESIS',
    );
  });

  it('uses the exact code passed in, without re-normalizing it', async () => {
    const executeRawUnsafe = vi.fn().mockResolvedValue(0);
    const tx = { $executeRawUnsafe: executeRawUnsafe };
    await lockCouponTx(tx as never, 'lowercase-should-pass-through');
    expect(executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'coupon:lowercase-should-pass-through',
    );
  });
});
