import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';
import { BackgroundMusic } from './BackgroundMusic';
import { SafeZoneGuides } from './SafeArea';

type ReelLayoutProps = {
  children: React.ReactNode;
  /** Affiche les zones de sécurité en rouge (à laisser à false pour l'export). */
  showSafeZones?: boolean;
  /** Active la musique de fond si public/music.mp3 existe. */
  music?: boolean;
};

/** Fond, police, halos de couleur et musique communs à tous les Reels. */
export const ReelLayout: React.FC<ReelLayoutProps> = ({
  children,
  showSafeZones = false,
  music = true,
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 60) * 40;

  return (
    <AbsoluteFill
      style={{ backgroundColor: COLORS.background, fontFamily: FONT_FAMILY, color: COLORS.text }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${20 + drift / 10}% ${15 + drift / 20}%, ${COLORS.primary}33 0%, transparent 45%),
            radial-gradient(circle at ${85 - drift / 10}% ${80 - drift / 20}%, ${COLORS.secondary}26 0%, transparent 40%)`,
        }}
      />
      {children}
      {music ? <BackgroundMusic /> : null}
      {showSafeZones ? <SafeZoneGuides /> : null}
    </AbsoluteFill>
  );
};
