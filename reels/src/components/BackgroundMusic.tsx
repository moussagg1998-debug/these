import React from 'react';
import { Html5Audio, interpolate, staticFile, useVideoConfig } from 'remotion';
import { MUSIC_VOLUME } from '../theme';
import { hasStaticFile } from '../utils/static-files';

export const MUSIC_FILE = 'music.mp3';

type BackgroundMusicProps = {
  /** Fichier dans public/. Par défaut : music.mp3. */
  file?: string;
  /** Volume max, de 0 à 1. Bas par défaut pour ne pas couvrir une voix. */
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
};

/**
 * Musique de fond en boucle, à volume bas, avec fondu d'entrée et de sortie.
 * Ne rend rien si le fichier n'existe pas dans public/ : la vidéo reste muette.
 */
export const BackgroundMusic: React.FC<BackgroundMusicProps> = ({
  file = MUSIC_FILE,
  volume = MUSIC_VOLUME,
  fadeInFrames = 15,
  fadeOutFrames = 30,
}) => {
  const { durationInFrames } = useVideoConfig();

  if (!hasStaticFile(file)) {
    return null;
  }

  const fadeInEnd = Math.min(fadeInFrames, durationInFrames / 2);
  const fadeOutStart = Math.max(durationInFrames - fadeOutFrames, fadeInEnd + 1);

  return (
    <Html5Audio
      src={staticFile(file)}
      loop
      loopVolumeCurveBehavior="extend"
      volume={(frame) =>
        interpolate(frame, [0, fadeInEnd, fadeOutStart, durationInFrames], [0, volume, volume, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      }
    />
  );
};
