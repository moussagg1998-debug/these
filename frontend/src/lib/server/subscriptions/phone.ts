/**
 * Chariow phone resolution — reproduces the 4-level fallback chain
 * documented in Chariow.md §3bis (`resolveChariowPhone` in the source
 * project's `chariow.ts`). Chariow's `/checkout` endpoint requires
 * `{ number: <national, no leading 0>, country_code: <ISO2> }` — an E.164
 * string in `number`, or a missing `country_code` for a non-African number,
 * both produce a 400 "Invalid phone number" from Chariow. This is the #1
 * documented cause of checkout failures, hence the defensive 4-tier chain
 * instead of a single parse attempt.
 */
import { parsePhoneNumberFromString, isSupportedCountry } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

export interface ResolvedChariowPhone {
  /** National number, no leading 0, no country/dial code. */
  number: string;
  /** ISO2 country code. */
  countryCode: string;
}

export interface ChariowPhoneInput {
  /** E.164, e.g. "+221771234567". */
  phone?: string | null;
  /** ISO2, e.g. "SN". */
  phoneCountry?: string | null;
  /** National number as typed by the user, e.g. "771234567" or "0771234567". */
  phoneLocal?: string | null;
}

// Chariow.md §3bis step 4 — African dial-code fallback table, longest-prefix
// checked first so e.g. "225" (CI) isn't shadowed by a shorter false match.
const AFRICAN_DIAL_CODES: readonly (readonly [string, string])[] = [
  ['221', 'SN'],
  ['225', 'CI'],
  ['229', 'BJ'],
  ['226', 'BF'],
  ['228', 'TG'],
  ['237', 'CM'],
  ['223', 'ML'],
  ['227', 'NE'],
  ['224', 'GN'],
  ['242', 'CG'],
  ['243', 'CD'],
  ['241', 'GA'],
  ['235', 'TD'],
  ['236', 'CF'],
  ['220', 'GM'],
  ['245', 'GW'],
  ['238', 'CV'],
  ['234', 'NG'],
  ['233', 'GH'],
  ['254', 'KE'],
];

export function resolveChariowPhone(input: ChariowPhoneInput): ResolvedChariowPhone | null {
  const country = input.phoneCountry?.trim().toUpperCase();

  // Level 1 — phoneCountry + phoneLocal via libphonenumber (strict validation).
  if (country && isSupportedCountry(country) && input.phoneLocal) {
    const parsed = parsePhoneNumberFromString(input.phoneLocal, country as CountryCode);
    if (parsed?.isValid()) {
      return { number: parsed.nationalNumber, countryCode: country };
    }
  }

  // Level 2 — E.164 `phone` alone, country deduced by libphonenumber.
  if (input.phone) {
    const parsed = parsePhoneNumberFromString(input.phone);
    if (parsed?.isValid() && parsed.country) {
      return { number: parsed.nationalNumber, countryCode: parsed.country };
    }
  }

  // Level 3 — phoneCountry + raw digits, no strict validation (repli).
  if (country && input.phoneLocal) {
    const digits = input.phoneLocal.replace(/\D/g, '').replace(/^0+/, '');
    if (digits) return { number: digits, countryCode: country };
  }

  // Level 4 — African dial-code fallback from whatever raw string we have.
  const raw = (input.phone ?? input.phoneLocal ?? '').replace(/\D/g, '');
  // Strip leading zeros/international prefix (00 or just 0s) to normalize
  const normalized = raw.replace(/^0+/, '');
  for (const [dial, iso2] of AFRICAN_DIAL_CODES) {
    if (normalized.startsWith(dial)) {
      const national = normalized.slice(dial.length).replace(/^0+/, '');
      if (national) return { number: national, countryCode: iso2 };
    }
  }

  return null;
}
