import React from 'react';
import { COLORS } from '../../theme';

type CoinShapeProps = {
  /** Rotation sur l'axe vertical en radians (pièce qui tourne). 0 = de face. */
  spin?: number;
  /** Identifiant unique pour les dégradés SVG. */
  id: string;
};

/**
 * Pièce dorée « F » à placer dans un <svg> (centrée en 0,0, rayon 48).
 * Utilisée par la tirelire, les piles et les pièces flottantes.
 */
export const CoinShape: React.FC<CoinShapeProps> = ({ spin = 0, id }) => {
  const scaleX = Math.max(0.08, Math.abs(Math.cos(spin)));
  const gradient = `coin-grad-${id}`;
  return (
    <g transform={`scale(${scaleX} 1)`}>
      <defs>
        <radialGradient id={gradient} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFF1B8" />
          <stop offset="45%" stopColor={COLORS.gold} />
          <stop offset="100%" stopColor={COLORS.primary} />
        </radialGradient>
      </defs>
      <circle r={48} fill={`url(#${gradient})`} stroke={COLORS.goldDark} strokeWidth={4} />
      <circle r={37} fill="none" stroke="#FFF3C4" strokeOpacity={0.7} strokeWidth={3} />
      <text
        y={15}
        textAnchor="middle"
        fontSize={44}
        fontWeight={900}
        fill={COLORS.goldDark}
        style={{ fontFamily: 'inherit' }}
      >
        F
      </text>
    </g>
  );
};

type CoinProps = CoinShapeProps & { size: number; style?: React.CSSProperties };

/** Pièce autonome (élément HTML). */
export const Coin: React.FC<CoinProps> = ({ size, style, ...shape }) => (
  <svg
    width={size}
    height={size}
    viewBox="-50 -50 100 100"
    style={{ overflow: 'visible', ...style }}
  >
    <CoinShape {...shape} />
  </svg>
);
