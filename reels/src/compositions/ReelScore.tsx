import React from 'react';
import { Series } from 'remotion';
import { CTA, Gauge, KineticText, ReelLayout, SafeArea, Scene } from '../components';
import { COLORS, TYPOGRAPHY } from '../theme';

export type ReelScoreProps = {
  handle: string;
  /** Score affiché sur la jauge, de 0 à 100. */
  score: number;
  showSafeZones: boolean;
};

export const reelScoreDefaults: ReelScoreProps = {
  handle: '@monpseudo',
  score: 78,
  showSafeZones: false,
};

const SCENES = { hook: 90, gauge: 150, cta: 120 } as const;
export const REEL_SCORE_DURATION = Object.values(SCENES).reduce((a, b) => a + b, 0);

/** Exemple : question d'accroche, score sur une jauge, appel à l'action. */
export const ReelScore: React.FC<ReelScoreProps> = ({ handle, score, showSafeZones }) => {
  const verdict = score >= 70 ? 'Excellent ! Continue comme ça' : 'Tu peux faire mieux, on t’aide';

  return (
    <ReelLayout showSafeZones={showSafeZones}>
      <Series>
        <Series.Sequence durationInFrames={SCENES.hook}>
          <Scene durationInFrames={SCENES.hook}>
            <SafeArea>
              <KineticText text="Quel est ton score d’épargne ?" highlight={['score']} />
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.gauge}>
          <Scene durationInFrames={SCENES.gauge}>
            <SafeArea gap={72}>
              <Gauge value={score} startFrame={10} durationInFrames={60} label="Score d’épargne" />
              <KineticText
                text={verdict}
                startFrame={80}
                {...TYPOGRAPHY.subtitle}
                highlight={['Excellent', 'mieux']}
                highlightColor={score >= 70 ? COLORS.secondary : COLORS.primary}
              />
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.cta}>
          <Scene durationInFrames={SCENES.cta}>
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
