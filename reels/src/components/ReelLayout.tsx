import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Backdrop } from './fx/Backdrop';
import { FloatingCoins } from './fx/Particles';
import { COLORS, FONT_FAMILY, MUSIC_VOLUME, MUSIC_VOLUME_UNDER_VOICE } from '../theme';
import { BackgroundMusic } from './BackgroundMusic';
import { SafeZoneGuides } from './SafeArea';

type ReelLayoutProps = {
  children: React.ReactNode;
  /** Affiche les zones de sécurité en rouge (à laisser à false pour l'export). */
  showSafeZones?: boolean;
  /** Active la musique de fond si public/music.mp3 existe. */
  music?: boolean;
  /** Baisse la musique pour laisser la place à la voix off. */
  duckMusic?: boolean;
};

/** Fond, police, halos de couleur et musique communs à tous les Reels. */
export const ReelLayout: React.FC<ReelLayoutProps> = ({
  children,
  showSafeZones = false,
  music = true,
  duckMusic = false,
}) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: COLORS.background, fontFamily: FONT_FAMILY, color: COLORS.text }}
    >
      <Backdrop />
      <FloatingCoins />
      {children}
      {music ? (
        <BackgroundMusic volume={duckMusic ? MUSIC_VOLUME_UNDER_VOICE : MUSIC_VOLUME} />
      ) : null}
      {showSafeZones ? <SafeZoneGuides /> : null}
    </AbsoluteFill>
  );
};
