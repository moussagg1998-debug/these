import { loadFont } from '@remotion/google-fonts/Poppins';

/**
 * Charte graphique commune à tous les Reels.
 * Modifie les valeurs ici : tous les composants et toutes les compositions suivent.
 */

const { fontFamily } = loadFont('normal', {
  weights: ['400', '600', '700', '800', '900'],
  subsets: ['latin', 'latin-ext'],
});

/** Format vertical Reels / TikTok / Shorts. */
export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

export const COLORS = {
  background: '#0F0F14',
  primary: '#FF7A00',
  secondary: '#22C55E',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.72)',
  surface: '#1B1B24',
  track: 'rgba(255, 255, 255, 0.12)',
} as const;

export const FONT_FAMILY = fontFamily;

export const FONT_WEIGHTS = {
  regular: 400,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
} as const;

/** Tailles de texte. Les titres sont en gras très gros. */
export const TYPOGRAPHY = {
  title: { fontSize: 112, fontWeight: FONT_WEIGHTS.black, lineHeight: 1.05 },
  subtitle: { fontSize: 64, fontWeight: FONT_WEIGHTS.bold, lineHeight: 1.15 },
  body: { fontSize: 46, fontWeight: FONT_WEIGHTS.semibold, lineHeight: 1.3 },
  caption: { fontSize: 36, fontWeight: FONT_WEIGHTS.semibold, lineHeight: 1.3 },
} as const;

/**
 * Zones de sécurité des Reels : l'interface d'Instagram / TikTok recouvre ces bandes.
 * Aucun texte important ne doit y apparaître.
 * - haut : nom du compte, onglets
 * - bas : légende, musique, pseudo
 * - droite : boutons like / commentaire / partage
 * La marge gauche n'est pas imposée par les plateformes : c'est un choix de mise en page.
 */
export const SAFE_ZONE = {
  top: 250,
  bottom: 400,
  right: 120,
  left: 80,
} as const;

/** Rectangle utilisable à l'intérieur des zones de sécurité (880 x 1270 px). */
export const SAFE_AREA = {
  x: SAFE_ZONE.left,
  y: SAFE_ZONE.top,
  width: VIDEO.width - SAFE_ZONE.left - SAFE_ZONE.right,
  height: VIDEO.height - SAFE_ZONE.top - SAFE_ZONE.bottom,
} as const;

/** Réglages de ressort (spring) partagés. */
export const SPRINGS = {
  /** Léger rebond, pour les apparitions de texte. */
  bounce: { damping: 12, stiffness: 180, mass: 0.6 },
  /** Mouvement fluide sans rebond. */
  smooth: { damping: 200 },
} as const;

/** Volume par défaut de la musique de fond (0 à 1). */
export const MUSIC_VOLUME = 0.15;

/** Volume de la musique quand une voix off joue par-dessus. */
export const MUSIC_VOLUME_UNDER_VOICE = 0.06;
