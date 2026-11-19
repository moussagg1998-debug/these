import React from 'react';
import { Composition } from 'remotion';
import {
  REEL_EPARGNE_DURATION,
  ReelEpargne,
  reelEpargneDefaults,
} from './compositions/ReelEpargne';
import { REEL_SCORE_DURATION, ReelScore, reelScoreDefaults } from './compositions/ReelScore';
import { VIDEO } from './theme';

/**
 * Liste des Reels. Chaque <Composition> devient une vidéo dans out/ avec `npm run render:all`.
 * Pour un nouveau Reel : copie un fichier de src/compositions/ et ajoute-le ici.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Reel-Epargne"
      component={ReelEpargne}
      durationInFrames={REEL_EPARGNE_DURATION}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={reelEpargneDefaults}
    />
    <Composition
      id="Reel-Score"
      component={ReelScore}
      durationInFrames={REEL_SCORE_DURATION}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={reelScoreDefaults}
    />
  </>
);
