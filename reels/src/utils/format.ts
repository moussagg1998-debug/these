/** Espace insécable : garde « 15 000 FCFA » sur une seule ligne. */
const NBSP = ' ';

/** 15000 -> « 15 000 » (séparateur de milliers = espace). */
export const formatNumber = (value: number): string => {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return sign + digits;
};

/** 15000 -> « 15 000 FCFA ». Le FCFA n'a pas de décimales. */
export const formatFCFA = (value: number): string => `${formatNumber(value)}${NBSP}FCFA`;
