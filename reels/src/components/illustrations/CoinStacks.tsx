import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../../theme';

type CoinStacksProps = {
  /** Nombre de pièces de chaque pile, de gauche à droite. */
  stacks: number[];
  /** Image où la première pièce tombe. */
  startFrame?: number;
  /** Écart entre deux pièces, en images. */
  framesPerCoin?: number;
  width?: number;
};

const COIN_W = 120;
const COIN_H = 22;
const RX = COIN_W / 2;
const RY = 16;

/** Piles de pièces vues de côté qui montent pièce par pièce (graphique en pièces). */
export const CoinStacks: React.FC<CoinStacksProps> = ({
  stacks,
  startFrame = 0,
  framesPerCoin = 2,
  width = 600,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tallest = Math.max(...stacks);
  const height = tallest * COIN_H + RY * 2 + 10;
  const gap = (width - stacks.length * COIN_W) / Math.max(1, stacks.length - 1);

  let order = 0;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="stack-side" x1="0" x2="1">
          <stop offset="0%" stopColor={COLORS.goldDark} />
          <stop offset="35%" stopColor={COLORS.gold} />
          <stop offset="100%" stopColor={COLORS.primaryDark} />
        </linearGradient>
      </defs>
      {stacks.map((count, s) => {
        const cx = s * (COIN_W + gap) + RX;
        return Array.from({ length: count }, (_, c) => {
          const at = startFrame + order++ * framesPerCoin;
          const drop = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 220 } });
          if (frame < at) return null;
          const baseY = height - RY - 4 - c * COIN_H;
          const y = baseY - (1 - drop) * 140;
          return (
            <g key={`${s}-${c}`} opacity={Math.min(1, drop * 2)}>
              <path
                d={`M ${cx - RX} ${y - COIN_H} L ${cx - RX} ${y} A ${RX} ${RY} 0 0 0 ${cx + RX} ${y} L ${cx + RX} ${y - COIN_H} Z`}
                fill="url(#stack-side)"
                stroke={COLORS.goldDark}
                strokeWidth={2}
              />
              <ellipse
                cx={cx}
                cy={y - COIN_H}
                rx={RX}
                ry={RY}
                fill={COLORS.gold}
                stroke={COLORS.goldDark}
                strokeWidth={2}
              />
              <ellipse
                cx={cx}
                cy={y - COIN_H}
                rx={RX * 0.7}
                ry={RY * 0.6}
                fill="none"
                stroke="#FFF3C4"
                strokeOpacity={0.6}
                strokeWidth={2}
              />
            </g>
          );
        });
      })}
    </svg>
  );
};

/** Nombre total de pièces : utile pour savoir quand la dernière tombe. */
export const coinStacksDuration = (stacks: number[], framesPerCoin = 2): number =>
  stacks.reduce((a, b) => a + b, 0) * framesPerCoin;
