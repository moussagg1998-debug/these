import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { COLORS, FONT_WEIGHTS, SAFE_AREA, TYPOGRAPHY } from '../theme';

type ProgressBarProps = {
  /** Remplissage final, de 0 à 100. */
  progress: number;
  /** Image où le remplissage démarre (relative à la séquence). */
  startFrame?: number;
  durationInFrames?: number;
  label?: string;
  /** Affiche le pourcentage à droite du libellé. */
  showValue?: boolean;
  color?: string;
  trackColor?: string;
  height?: number;
  width?: number;
};

/** Barre qui se remplit avec animation, avec libellé et pourcentage. */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  startFrame = 0,
  durationInFrames = 40,
  label,
  showValue = true,
  color = COLORS.primary,
  trackColor = COLORS.track,
  height = 40,
  width = SAFE_AREA.width,
}) => {
  const frame = useCurrentFrame();
  const target = Math.min(100, Math.max(0, progress));
  const current = interpolate(frame, [startFrame, startFrame + durationInFrames], [0, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const appear = interpolate(frame, [startFrame - 8, startFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ width, opacity: appear, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {label || showValue ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontSize: TYPOGRAPHY.body.fontSize,
            fontWeight: FONT_WEIGHTS.bold,
          }}
        >
          <span>{label}</span>
          {showValue ? (
            <span
              style={{ color, fontWeight: FONT_WEIGHTS.black, fontVariantNumeric: 'tabular-nums' }}
            >
              {Math.round(current)}
              {' %'}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        style={{
          width: '100%',
          height,
          borderRadius: height,
          background: trackColor,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${current}%`,
            height: '100%',
            borderRadius: height,
            background: `linear-gradient(90deg, ${color}CC 0%, ${color} 100%)`,
            boxShadow: `0 0 ${height}px ${color}88`,
          }}
        />
      </div>
    </div>
  );
};
