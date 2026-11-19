import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, SPRINGS } from '../../theme';
import { CoinShape } from './Coin';

type PiggyBankProps = {
  /** Largeur en pixels (hauteur ≈ 0,8 x largeur). */
  width?: number;
  /** Image d'apparition de la tirelire. */
  startFrame?: number;
  /** Images où une pièce tombe dans la fente. */
  coinDrops?: number[];
};

const FALL_FRAMES = 14;
const SLOT = { x: 200, y: 66 };

/** Moment où chaque pièce touche la fente (pour synchroniser les bruitages). */
export const coinImpactFrames = (coinDrops: number[]): number[] =>
  coinDrops.map((d) => d + FALL_FRAMES);

/** Tirelire verte qui avale des pièces, avec rebond à chaque impact. */
export const PiggyBank: React.FC<PiggyBankProps> = ({
  width = 560,
  startFrame = 0,
  coinDrops = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - startFrame, fps, config: SPRINGS.bounce });
  const enterScale = interpolate(enter, [0, 1], [0.3, 1]);
  const wobble = Math.sin((frame - startFrame) / 8) * 2 * (1 - Math.min(1, enter));

  // Écrasement à chaque pièce reçue.
  const squash = coinImpactFrames(coinDrops).reduce((acc, at) => {
    const t = frame - at;
    if (t < 0) return acc;
    return acc + Math.exp(-t / 5) * Math.cos(t / 1.6);
  }, 0);
  const sx = 1 + 0.05 * squash;
  const sy = 1 - 0.07 * squash;
  const blink = (frame - startFrame) % 70 > 66 ? 0.15 : 1;

  return (
    <svg
      width={width}
      height={width * 0.8}
      viewBox="0 -40 400 360"
      style={{ overflow: 'visible', transform: `scale(${enterScale}) rotate(${wobble}deg)` }}
    >
      <defs>
        <radialGradient id="piggy-body" cx="38%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#86EFAC" />
          <stop offset="55%" stopColor={COLORS.secondary} />
          <stop offset="100%" stopColor={COLORS.secondaryDark} />
        </radialGradient>
      </defs>

      {/* Ombre au sol */}
      <ellipse cx={200} cy={300} rx={140 * sx} ry={16} fill="#000" opacity={0.35} />

      <g transform={`translate(200 300) scale(${sx} ${sy}) translate(-200 -300)`}>
        {/* Pattes */}
        {[95, 140, 255, 300].map((x) => (
          <rect
            key={x}
            x={x - 18}
            y={240}
            width={36}
            height={58}
            rx={14}
            fill={COLORS.secondaryDark}
          />
        ))}
        {/* Queue */}
        <path
          d="M 58 170 q -38 -6 -30 -34 q 8 -22 26 -8 q 12 12 -6 20"
          fill="none"
          stroke={COLORS.secondaryDark}
          strokeWidth={9}
          strokeLinecap="round"
        />
        {/* Corps */}
        <ellipse cx={200} cy={175} rx={150} ry={112} fill="url(#piggy-body)" />
        {/* Reflet */}
        <ellipse
          cx={150}
          cy={120}
          rx={70}
          ry={34}
          fill="#fff"
          opacity={0.22}
          transform="rotate(-18 150 120)"
        />
        {/* Oreille */}
        <path d="M 270 82 L 300 28 L 328 96 Z" fill={COLORS.secondaryDark} />
        <path d="M 283 80 L 300 48 L 316 88 Z" fill="#86EFAC" opacity={0.6} />
        {/* Groin */}
        <ellipse
          cx={346}
          cy={180}
          rx={36}
          ry={42}
          fill="#4ADE80"
          stroke={COLORS.secondaryDark}
          strokeWidth={5}
        />
        <ellipse cx={336} cy={172} rx={6} ry={10} fill={COLORS.secondaryDark} />
        <ellipse cx={356} cy={172} rx={6} ry={10} fill={COLORS.secondaryDark} />
        {/* Œil */}
        <ellipse cx={298} cy={138} rx={10} ry={10 * blink} fill={COLORS.background} />
        <circle cx={301} cy={134} r={3} fill="#fff" opacity={blink} />
        {/* Joue */}
        <ellipse cx={300} cy={190} rx={20} ry={12} fill={COLORS.primary} opacity={0.35} />
        {/* Fente */}
        <rect
          x={SLOT.x - 38}
          y={SLOT.y - 8}
          width={76}
          height={14}
          rx={7}
          fill={COLORS.background}
        />
      </g>

      {/* Pièces qui tombent dans la fente */}
      {coinDrops.map((drop, i) => {
        const t = frame - drop;
        if (t < 0 || t > FALL_FRAMES) return null;
        const y = interpolate(t, [0, FALL_FRAMES], [-420, SLOT.y - 6], {
          easing: Easing.in(Easing.quad),
        });
        return (
          <g key={drop} transform={`translate(${SLOT.x} ${y}) scale(0.62)`}>
            <CoinShape spin={t / 2.2 + i} id={`piggy-${i}`} />
          </g>
        );
      })}
    </svg>
  );
};
