import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { COLORS, FONT_WEIGHTS, TYPOGRAPHY } from '../theme';

type GaugeProps = {
  /** Valeur finale, de 0 à 100. */
  value: number;
  /** Image où l'aiguille démarre (relative à la séquence). */
  startFrame?: number;
  durationInFrames?: number;
  /** Largeur de la jauge en pixels (la hauteur vaut environ la moitié). */
  size?: number;
  strokeWidth?: number;
  label?: string;
  /** Couleurs du dégradé, de gauche (0) à droite (100). */
  fromColor?: string;
  toColor?: string;
  trackColor?: string;
};

/** Jauge semi-circulaire animée de 0 à 100. */
export const Gauge: React.FC<GaugeProps> = ({
  value,
  startFrame = 0,
  durationInFrames = 50,
  size = 760,
  strokeWidth = 56,
  label,
  fromColor = COLORS.primary,
  toColor = COLORS.secondary,
  trackColor = COLORS.track,
}) => {
  const frame = useCurrentFrame();
  const target = Math.min(100, Math.max(0, value));
  const current = interpolate(frame, [startFrame, startFrame + durationInFrames], [0, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const height = cy + strokeWidth / 2;
  const arcLength = Math.PI * radius;
  const arc = `M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${cy}`;

  // Position du curseur au bout de l'arc : de la gauche (180°) vers la droite (0°).
  const angle = Math.PI * (1 - current / 100);
  const knobX = cx + radius * Math.cos(angle);
  const knobY = cy - radius * Math.sin(angle);
  const gradientId = 'gauge-gradient';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div style={{ position: 'relative', width: size, height }}>
        <svg
          width={size}
          height={height}
          viewBox={`0 0 ${size} ${height}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={size}
              y2="0"
            >
              <stop offset="0%" stopColor={fromColor} />
              <stop offset="100%" stopColor={toColor} />
            </linearGradient>
          </defs>
          <path
            d={arc}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={arc}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={arcLength * (1 - current / 100)}
            opacity={current > 0.5 ? 1 : 0}
          />
          <circle
            cx={knobX}
            cy={knobY}
            r={strokeWidth * 0.62}
            fill={COLORS.text}
            stroke={COLORS.background}
            strokeWidth={8}
            opacity={current > 0.5 ? 1 : 0}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'baseline',
            gap: 8,
            fontWeight: FONT_WEIGHTS.black,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: size * 0.24 }}>{Math.round(current)}</span>
          <span style={{ fontSize: size * 0.07, color: COLORS.textMuted }}>/100</span>
        </div>
      </div>
      {label ? (
        <div
          style={{
            fontSize: TYPOGRAPHY.subtitle.fontSize * 0.75,
            fontWeight: FONT_WEIGHTS.bold,
            color: COLORS.textMuted,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
