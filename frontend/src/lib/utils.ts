import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a byte count as a human-readable French size string (Ko/Mo/Go). */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 Ko';
  const units = ['Ko', 'Mo', 'Go', 'To'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = value < 10 ? value.toFixed(1) : Math.round(value).toString();
  return `${formatted.replace('.', ',')} ${units[unitIndex]}`;
}

/** Format an integer amount with regular ASCII space as thousands separator. */
export function formatPrice(amount: number, currency: string = ''): string {
  // Some locales (e.g. fr-FR) emit non-breaking spaces (U+00A0) as the
  // grouping separator; normalise any whitespace to a regular space for
  // predictable output.
  const formatted = amount.toLocaleString('fr-FR').replace(/\s/g, ' ');
  return currency ? `${formatted} ${currency}` : formatted;
}

/**
 * Detect in-app browsers (Facebook, Instagram, TikTok). These WebViews
 * often block redirects to native payment apps.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|TikTok|musical_ly|BytedanceWebview/i.test(ua);
}

/** Detect specifically the TikTok WebView. */
export function isTikTokBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /TikTok|musical_ly|BytedanceWebview/i.test(ua);
}
