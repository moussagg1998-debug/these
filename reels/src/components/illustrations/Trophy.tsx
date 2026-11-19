import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../../theme';

type TrophyProps = {
  size?: number;
  startFrame?: number;
};

/** Trophée doré qui surgit avec des rayons lumineux tournants. */
export const Trophy: React.FC<TrophyProps> = ({ size = 260, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - startFrame;
  const pop = spring({ frame: t, fps, config: { damping: 9, stiffness: 160 } });
  if (t < 0) return null;

  const scale = interpolate(pop, [0, 1], [0, 1]);
  const tilt = interpolate(pop, [0, 1], [-25, 0]);
  const shine = ((t * 6) % 260) - 80;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-100 -100 200 200"
      style={{ overflow: 'visible', transform: `scale(${scale}) rotate(${tilt}deg)` }}
    >
      <defs>
        <linearGradient id="trophy-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFF1B8" />
          <stop offset="40%" stopColor={COLORS.gold} />
          <stop offset="100%" stopColor={COLORS.primary} />
        </linearGradient>
        <clipPath id="trophy-cup">
          <path d="M -48 -70 L 48 -70 L 44 -10 Q 40 28 0 34 Q -40 28 -44 -10 Z" />
        </clipPath>
      </defs>
      {/* Rayons */}
      <g transform={`rotate(${t * 1.5})`} opacity={0.35 * scale}>
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d="M 0 0 L -12 -150 L 12 -150 Z"
            fill={COLORS.gold}
            transform={`rotate(${i * 30})`}
          />
        ))}
      </g>
      {/* Anses */}
      <path
        d="M -46 -58 Q -92 -56 -80 -18 Q -70 6 -36 4"
        fill="none"
        stroke={COLORS.gold}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <path
        d="M 46 -58 Q 92 -56 80 -18 Q 70 6 36 4"
        fill="none"
        stroke={COLORS.gold}
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* Coupe */}
      <path
        d="M -48 -70 L 48 -70 L 44 -10 Q 40 28 0 34 Q -40 28 -44 -10 Z"
        fill="url(#trophy-gold)"
        stroke={COLORS.goldDark}
        strokeWidth={4}
      />
      <rect
        x={shine}
        y={-80}
        width={18}
        height={130}
        fill="#fff"
        opacity={0.45}
        transform="skewX(-20)"
        clipPath="url(#trophy-cup)"
      />
      {/* Pied */}
      <rect
        x={-10}
        y={32}
        width={20}
        height={26}
        fill={COLORS.gold}
        stroke={COLORS.goldDark}
        strokeWidth={3}
      />
      <rect
        x={-46}
        y={56}
        width={92}
        height={22}
        rx={6}
        fill={COLORS.primaryDark}
        stroke={COLORS.goldDark}
        strokeWidth={3}
      />
      {/* Étoile */}
      <path
        d="M 0 -52 L 7 -36 L 24 -35 L 11 -24 L 15 -8 L 0 -17 L -15 -8 L -11 -24 L -24 -35 L -7 -36 Z"
        fill="#FFF7D6"
      />
    </svg>
  );
};
