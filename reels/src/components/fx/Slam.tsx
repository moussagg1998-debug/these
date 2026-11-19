import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

type SlamProps = {
  children: React.ReactNode;
  startFrame?: number;
  /** Échelle de départ : l'élément arrive en très gros plan puis se pose. */
  from?: number;
};

/** Entrée « coup de poing » : très gros et flou, puis net à sa place avec un rebond. */
export const Slam: React.FC<SlamProps> = ({ children, startFrame = 0, from = 2.6 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 13, stiffness: 170 } });
  const scale = interpolate(s, [0, 1], [from, 1]);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        filter: `blur(${Math.max(0, 1 - s) * 16}px)`,
        opacity: frame < startFrame ? 0 : Math.min(1, s * 2),
      }}
    >
      {children}
    </div>
  );
};
