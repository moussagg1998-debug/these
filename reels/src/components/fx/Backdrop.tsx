import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../../theme';

/**
 * Fond animé : halos de couleur qui dérivent, grille en perspective qui défile,
 * grain et vignettage. Purement décoratif.
 */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const a = Math.sin(frame / 70);
  const b = Math.cos(frame / 90);
  const gridOffset = (frame * 1.6) % 80;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, overflow: 'hidden' }}>
      {/* Halos */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${25 + a * 8}% ${18 + b * 5}%, ${COLORS.primary}40 0%, transparent 42%),
            radial-gradient(circle at ${80 - a * 8}% ${78 - b * 5}%, ${COLORS.secondary}30 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, #ffffff08 0%, transparent 60%)`,
        }}
      />
      {/* Grille en perspective (sol) */}
      <div
        style={{
          position: 'absolute',
          left: '-50%',
          right: '-50%',
          bottom: -200,
          height: 1100,
          transform: 'perspective(700px) rotateX(62deg)',
          transformOrigin: 'bottom center',
          backgroundImage: `linear-gradient(${COLORS.primary}26 2px, transparent 2px),
            linear-gradient(90deg, ${COLORS.primary}26 2px, transparent 2px)`,
          backgroundSize: '80px 80px',
          backgroundPosition: `0 ${gridOffset}px`,
          maskImage: 'linear-gradient(to top, black 10%, transparent 85%)',
          WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 85%)',
        }}
      />
      {/* Grain */}
      <AbsoluteFill style={{ opacity: 0.06, mixBlendMode: 'overlay' }}>
        <svg width="100%" height="100%">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 8} />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </AbsoluteFill>
      {/* Vignettage */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 55%, #00000099 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
