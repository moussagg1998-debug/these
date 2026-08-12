import { describe, it, expect } from 'vitest';
import { effectivePlan, hasFeature, maxStudents } from './entitlements';

const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

describe('effectivePlan', () => {
  it('FREE with no expiry stays FREE', () => {
    expect(effectivePlan({ plan: 'FREE', planExpiresAt: null })).toBe('FREE');
  });

  it('ESSENTIEL with no expiry set is ESSENTIEL (lifetime/no-expiry case)', () => {
    expect(effectivePlan({ plan: 'ESSENTIEL', planExpiresAt: null })).toBe('ESSENTIEL');
  });

  it('ESSENTIEL with a future expiry is ESSENTIEL', () => {
    expect(effectivePlan({ plan: 'ESSENTIEL', planExpiresAt: future })).toBe('ESSENTIEL');
  });

  it('ESSENTIEL with a past expiry (not yet swept by the cron) is FREE', () => {
    expect(effectivePlan({ plan: 'ESSENTIEL', planExpiresAt: past })).toBe('FREE');
  });

  it('an unrecognized plan string is treated as FREE', () => {
    expect(effectivePlan({ plan: 'BOGUS', planExpiresAt: null })).toBe('FREE');
  });
});

describe('hasFeature', () => {
  it('FREE user does not have BULK_REMINDERS', () => {
    expect(hasFeature({ plan: 'FREE', planExpiresAt: null }, 'BULK_REMINDERS')).toBe(false);
  });

  it('active ESSENTIEL user has BULK_REMINDERS', () => {
    expect(hasFeature({ plan: 'ESSENTIEL', planExpiresAt: future }, 'BULK_REMINDERS')).toBe(true);
  });

  it('expired ESSENTIEL user does not have BULK_REMINDERS', () => {
    expect(hasFeature({ plan: 'ESSENTIEL', planExpiresAt: past }, 'BULK_REMINDERS')).toBe(false);
  });
});

describe('maxStudents', () => {
  it('FREE caps at 2', () => {
    expect(maxStudents({ plan: 'FREE', planExpiresAt: null })).toBe(2);
  });

  it('active ESSENTIEL caps at 20', () => {
    expect(maxStudents({ plan: 'ESSENTIEL', planExpiresAt: future })).toBe(20);
  });

  it('expired ESSENTIEL falls back to the FREE cap of 2', () => {
    expect(maxStudents({ plan: 'ESSENTIEL', planExpiresAt: past })).toBe(2);
  });
});
