import React from 'react';
import { Camera } from './fx/Camera';

type SceneProps = {
  children: React.ReactNode;
  /** Durée de la scène, pour le travelling de caméra. */
  durationInFrames: number;
  /** Images où la caméra donne un coup de zoom (temps forts). */
  punches?: number[];
  zoomFrom?: number;
  zoomTo?: number;
};

/**
 * Scène filmée par la caméra virtuelle (travelling avant + coups de zoom).
 * Les transitions entre scènes sont gérées par <TransitionSeries> dans chaque Reel.
 */
export const Scene: React.FC<SceneProps> = ({ children, ...camera }) => (
  <Camera {...camera}>{children}</Camera>
);
