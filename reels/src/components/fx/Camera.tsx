import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from 'remotion';
import { CAMERA_MAX_ZOOM, SAFE_CENTER } from '../../theme';

type CameraProps = {
  children: React.ReactNode;
  /** Durée de la scène, pour le travelling avant. */
  durationInFrames: number;
  /** Zoom au début et à la fin de la scène (travelling lent). */
  zoomFrom?: number;
  zoomTo?: number;
  /** Images où la caméra donne un « coup de zoom » avec léger tremblement. */
  punches?: number[];
};

const PUNCH_STRENGTH = 0.015;

/**
 * Caméra virtuelle : travelling avant lent + coups de zoom sur les temps forts.
 * Le zoom total ne dépasse jamais CAMERA_MAX_ZOOM, pour rester dans les zones de sécurité.
 */
export const Camera: React.FC<CameraProps> = ({
  children,
  durationInFrames,
  zoomFrom = 1,
  zoomTo = 1.035,
  punches = [],
}) => {
  const frame = useCurrentFrame();

  const drift = interpolate(frame, [0, durationInFrames], [zoomFrom, zoomTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  // Enveloppe d'impact : montée en 3 images, retombée amortie.
  const impact = punches.reduce((acc, at) => {
    const t = frame - at;
    if (t < 0) return acc;
    const rise = Math.min(1, t / 3);
    return acc + rise * Math.exp(-t / 9);
  }, 0);

  const scale = Math.min(CAMERA_MAX_ZOOM, drift + PUNCH_STRENGTH * Math.min(1, impact));
  const shakeX = (random(`shake-x-${frame}`) - 0.5) * 10 * Math.min(1, impact);
  const shakeY = (random(`shake-y-${frame}`) - 0.5) * 10 * Math.min(1, impact);

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${shakeX}px, ${shakeY}px) scale(${scale})`,
        transformOrigin: `${SAFE_CENTER.x}px ${SAFE_CENTER.y}px`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
