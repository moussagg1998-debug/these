import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

type SceneProps = {
  children: React.ReactNode;
  /** Durée de la scène, pour placer le fondu de sortie. */
  durationInFrames: number;
  fadeFrames?: number;
};

/** Scène avec fondu d'entrée et de sortie. À placer dans une <Series.Sequence>. */
export const Scene: React.FC<SceneProps> = ({ children, durationInFrames, fadeFrames = 10 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
