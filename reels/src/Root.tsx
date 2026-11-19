import React from 'react';
import { Composition } from 'remotion';
import {
  calculateReelEpargneMetadata,
  REEL_EPARGNE_DURATION,
  REEL_EPARGNE_ID,
  ReelEpargne,
  reelEpargneDefaults,
} from './compositions/ReelEpargne';
import {
  calculateReelScoreMetadata,
  REEL_SCORE_DURATION,
  REEL_SCORE_ID,
  ReelScore,
  reelScoreDefaults,
} from './compositions/ReelScore';
import { VIDEO } from './theme';

/**
 * Liste des Reels. Chaque <Composition> devient une vidéo dans out/ avec `npm run render:all`.
 * Pour un nouveau Reel : copie un fichier de src/compositions/ et ajoute-le ici.
 * La durée finale est recalculée à partir des clips de voix off (calculateMetadata).
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id={REEL_EPARGNE_ID}
      component={ReelEpargne}
      durationInFrames={REEL_EPARGNE_DURATION}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={reelEpargneDefaults}
      calculateMetadata={calculateReelEpargneMetadata}
    />
    <Composition
      id={REEL_SCORE_ID}
      component={ReelScore}
      durationInFrames={REEL_SCORE_DURATION}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={reelScoreDefaults}
      calculateMetadata={calculateReelScoreMetadata}
    />
  </>
);
