import { describe, it, expect } from 'vitest';
import { resolveChariowPhone } from './phone';

describe('resolveChariowPhone', () => {
  it('level 1 — phoneCountry + phoneLocal via libphonenumber, strips leading 0', () => {
    const result = resolveChariowPhone({ phoneCountry: 'FR', phoneLocal: '0763627155' });
    expect(result).toEqual({ number: '763627155', countryCode: 'FR' });
  });

  it('level 2 — E.164 phone alone, country deduced', () => {
    const result = resolveChariowPhone({ phone: '+221771234567' });
    expect(result).toEqual({ number: '771234567', countryCode: 'SN' });
  });

  it('level 3 — phoneCountry + raw digits, no strict validation', () => {
    const result = resolveChariowPhone({ phoneCountry: 'BJ', phoneLocal: '97000000' });
    expect(result).toEqual({ number: '97000000', countryCode: 'BJ' });
  });

  it('level 4 — African dial-code fallback from a raw E.164-ish string', () => {
    const result = resolveChariowPhone({ phone: '0022890000000' });
    expect(result).toEqual({ number: '90000000', countryCode: 'TG' });
  });

  it('returns null when nothing resolves', () => {
    expect(resolveChariowPhone({})).toBeNull();
    expect(resolveChariowPhone({ phone: 'not-a-number' })).toBeNull();
  });

  it('prefers level 1 over level 2 when both are present and level 1 validates', () => {
    const result = resolveChariowPhone({
      phoneCountry: 'SN',
      phoneLocal: '771234567',
      phone: '+33763627155', // deliberately different — level 1 must win
    });
    expect(result).toEqual({ number: '771234567', countryCode: 'SN' });
  });
});
