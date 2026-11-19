import React from 'react';
import { Series } from 'remotion';
import { CTA, Gauge, KineticText, ReelLayout, SafeArea, Scene, VoiceOver } from '../components';
import { COLORS, TYPOGRAPHY } from '../theme';
import type { SceneDurations, SceneSpec } from '../voiceover';
import { fitScenesToVoiceover, hasVoiceover, minSceneDurations, totalFrames } from '../voiceover';

export const REEL_SCORE_ID = 'Reel-Score';

type SceneKey = 'hook' | 'gauge' | 'cta';

/** Durées minimales ; chaque scène s'allonge si sa voix off est plus longue. */
const SCENES: SceneSpec<SceneKey>[] = [
  { key: 'hook', minFrames: 90 },
  { key: 'gauge', minFrames: 150 },
  { key: 'cta', minFrames: 120 },
];

export type ReelScoreProps = {
  handle: string;
  /** Score affiché sur la jauge, de 0 à 100. */
  score: number;
  showSafeZones: boolean;
  /** Calculé automatiquement à partir des clips de voix off. */
  sceneDurations: SceneDurations<SceneKey>;
};

export const reelScoreDefaults: ReelScoreProps = {
  handle: '@monpseudo',
  score: 78,
  showSafeZones: false,
  sceneDurations: minSceneDurations(SCENES),
};

export const REEL_SCORE_DURATION = totalFrames(reelScoreDefaults.sceneDurations);

export const calculateReelScoreMetadata = fitScenesToVoiceover<SceneKey, ReelScoreProps>(
  REEL_SCORE_ID,
  SCENES,
);

/** Exemple : question d'accroche, score sur une jauge, appel à l'action. */
export const ReelScore: React.FC<ReelScoreProps> = ({
  handle,
  score,
  showSafeZones,
  sceneDurations: d,
}) => {
  const verdict = score >= 70 ? 'Excellent ! Continue comme ça' : 'Tu peux faire mieux, on t’aide';
  const voiced = SCENES.some((s) => hasVoiceover(REEL_SCORE_ID, s.key));

  return (
    <ReelLayout showSafeZones={showSafeZones} duckMusic={voiced}>
      <Series>
        <Series.Sequence durationInFrames={d.hook}>
          <Scene durationInFrames={d.hook}>
            <VoiceOver reelId={REEL_SCORE_ID} sceneKey="hook" />
            <SafeArea>
              <KineticText text="Quel est ton score d’épargne ?" highlight={['score']} />
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={d.gauge}>
          <Scene durationInFrames={d.gauge}>
            <VoiceOver reelId={REEL_SCORE_ID} sceneKey="gauge" />
            <SafeArea gap={72}>
              <Gauge value={score} startFrame={10} durationInFrames={60} label="Score d’épargne" />
              <KineticText
                text={verdict}
                startFrame={75}
                {...TYPOGRAPHY.subtitle}
                highlight={['Excellent', 'mieux']}
                highlightColor={score >= 70 ? COLORS.secondary : COLORS.primary}
              />
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={d.cta}>
          <Scene durationInFrames={d.cta}>
            <VoiceOver reelId={REEL_SCORE_ID} sceneKey="cta" />
            <SafeArea>
              <CTA
                handle={handle}
                subtitle="Calcule ton score en commentaire"
                title="Et toi ?"
                buttonLabel="Commenter"
              />
            </SafeArea>
          </Scene>
        </Series.Sequence>
      </Series>
    </ReelLayout>
  );
};
