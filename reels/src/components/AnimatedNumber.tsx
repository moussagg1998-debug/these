import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_WEIGHTS, SAFE_AREA, SPRINGS } from '../theme';
import { formatNumber } from '../utils/format';

type AnimatedNumberProps = {
  /** Valeur finale, en FCFA (entier). */
  value: number;
  /** Valeur de départ. */
  from?: number;
  /** Image où le compteur démarre (relative à la séquence). */
  startFrame?: number;
  /** Durée de la montée, en images. */
  durationInFrames?: number;
  fontSize?: number;
  color?: string;
  /** Affiche « FCFA » après le nombre. */
  showCurrency?: boolean;
  /** Largeur max : la taille du texte est réduite si le nombre est trop long. */
  maxWidth?: number;
  style?: React.CSSProperties;
};

/** Largeur moyenne d'un chiffre en Poppins Black, en fraction de la taille de police. */
const DIGIT_WIDTH_RATIO = 0.66;
const CURRENCY_RATIO = 0.42;

/** Compteur qui monte jusqu'à une valeur, affiché « 15 000 FCFA ». */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  from = 0,
  startFrame = 0,
  durationInFrames = 45,
  fontSize = 150,
  color = COLORS.primary,
  showCurrency = true,
  maxWidth = SAFE_AREA.width,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(frame, [startFrame, startFrame + durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const current = from + (value - from) * progress;

  // Petit « pop » quand le compteur atteint sa valeur finale.
  const pop = spring({
    frame: frame - startFrame - durationInFrames,
    fps,
    config: SPRINGS.smooth,
    durationInFrames: 12,
  });
  const scale = interpolate(pop, [0, 0.5, 1], [1, 1.08, 1]);

  // Réduit la police si le nombre final déborderait de la zone sûre.
  const finalChars = formatNumber(value).length;
  // « FCFA » fait environ 2,6 em de sa propre taille, plus l'écart avant.
  const currencyWidth = showCurrency ? CURRENCY_RATIO * 2.6 + 0.18 : 0;
  const estimatedWidth = fontSize * (finalChars * DIGIT_WIDTH_RATIO + currencyWidth);
  const size = estimatedWidth > maxWidth ? (fontSize * maxWidth) / estimatedWidth : fontSize;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: size * 0.18,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: FONT_WEIGHTS.black,
        lineHeight: 1,
        color,
        transform: `scale(${scale})`,
        ...style,
      }}
    >
      <span style={{ fontSize: size, letterSpacing: -size * 0.02 }}>{formatNumber(current)}</span>
      {showCurrency ? (
        <span
          style={{
            fontSize: size * CURRENCY_RATIO,
            fontWeight: FONT_WEIGHTS.extrabold,
            color: COLORS.text,
          }}
        >
          FCFA
        </span>
      ) : null}
    </div>
  );
};
