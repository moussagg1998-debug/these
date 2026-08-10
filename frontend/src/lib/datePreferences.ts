// Settings → "Général" — shared source of truth for the allowed
// timezone/date-format values (consumed by both the /api/profile zod schema
// and the client-side <select> options + formatDate()), plus a tiny
// module-level store so formatDate() can honor the signed-in user's
// preference without threading it through the ~13 call sites that already
// call it. DatePreferencesSync (contexts/) populates it once per session.
export const DATE_FORMAT_VALUES = ['long', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;
export type DateFormatValue = (typeof DATE_FORMAT_VALUES)[number];

export const DATE_FORMAT_OPTIONS: { value: DateFormatValue; label: string }[] = [
  { value: 'long', label: 'Format long (8 août 2026)' },
  { value: 'DD/MM/YYYY', label: 'JJ/MM/AAAA (08/08/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/JJ/AAAA (08/08/2026)' },
  { value: 'YYYY-MM-DD', label: 'AAAA-MM-JJ (2026-08-08)' },
];

// A short curated list (not the full ~400-zone IANA database) covering
// Francophone Africa plus a couple of common reference zones.
export const TIMEZONE_VALUES = [
  'Africa/Dakar',
  'Africa/Abidjan',
  'Africa/Casablanca',
  'Africa/Lagos',
  'Africa/Cairo',
  'Africa/Nairobi',
  'Europe/Paris',
  'UTC',
] as const;
export type TimezoneValue = (typeof TIMEZONE_VALUES)[number];

export const TIMEZONE_OPTIONS: { value: TimezoneValue; label: string }[] = [
  { value: 'Africa/Dakar', label: 'UTC+0 — Dakar, Bamako, Conakry, Ouagadougou' },
  { value: 'Africa/Abidjan', label: 'UTC+0 — Abidjan' },
  { value: 'Africa/Casablanca', label: 'UTC+1 — Casablanca, Rabat' },
  { value: 'Africa/Lagos', label: 'UTC+1 — Lagos, Douala, Libreville, Kinshasa' },
  { value: 'Africa/Cairo', label: 'UTC+2 — Le Caire' },
  { value: 'Africa/Nairobi', label: 'UTC+3 — Nairobi' },
  { value: 'Europe/Paris', label: 'UTC+1/+2 — Paris' },
  { value: 'UTC', label: 'UTC' },
];

export const LOCALE_VALUES = ['fr'] as const;
export type LocaleValue = (typeof LOCALE_VALUES)[number];

export const LOCALE_OPTIONS: { value: LocaleValue; label: string }[] = [
  { value: 'fr', label: 'Français' },
];

let currentDateFormat: DateFormatValue = 'long';
let currentTimezone: TimezoneValue = 'Africa/Dakar';

export function setDatePreferences(prefs: {
  dateFormat?: string | null | undefined;
  timezone?: string | null | undefined;
}) {
  if (prefs.dateFormat && (DATE_FORMAT_VALUES as readonly string[]).includes(prefs.dateFormat)) {
    currentDateFormat = prefs.dateFormat as DateFormatValue;
  }
  if (prefs.timezone && (TIMEZONE_VALUES as readonly string[]).includes(prefs.timezone)) {
    currentTimezone = prefs.timezone as TimezoneValue;
  }
}

export function getDatePreferences(): { dateFormat: DateFormatValue; timezone: TimezoneValue } {
  return { dateFormat: currentDateFormat, timezone: currentTimezone };
}
