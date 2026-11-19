import React from 'react';
import { Series } from 'remotion';
import {
  AnimatedNumber,
  CTA,
  KineticText,
  ProgressBar,
  ReelLayout,
  SafeArea,
  Scene,
  VoiceOver,
} from '../components';
import { COLORS, TYPOGRAPHY } from '../theme';
import { formatFCFA } from '../utils/format';
import type { SceneDurations, SceneSpec } from '../voiceover';
import { fitScenesToVoiceover, hasVoiceover, minSceneDurations, totalFrames } from '../voiceover';

export const REEL_EPARGNE_ID = 'Reel-Epargne';

type SceneKey = 'hook' | 'goal' | 'progress' | 'cta';

/** Durées minimales ; chaque scène s'allonge si sa voix off est plus longue. */
const SCENES: SceneSpec<SceneKey>[] = [
  { key: 'hook', minFrames: 90 },
  { key: 'goal', minFrames: 120 },
  { key: 'progress', minFrames: 120 },
  { key: 'cta', minFrames: 120 },
];

export type ReelEpargneProps = {
  handle: string;
  /** Objectif d'épargne mensuel en FCFA. */
  monthlyGoal: number;
  /** Progression de chaque mois, de 0 à 100. */
  months: { label: string; progress: number }[];
  showSafeZones: boolean;
  /** Calculé automatiquement à partir des clips de voix off. */
  sceneDurations: SceneDurations<SceneKey>;
};

export const reelEpargneDefaults: ReelEpargneProps = {
  handle: '@monpseudo',
  monthlyGoal: 15000,
  months: [
    { label: 'Mois 1', progress: 35 },
    { label: 'Mois 2', progress: 68 },
    { label: 'Mois 3', progress: 100 },
  ],
  showSafeZones: false,
  sceneDurations: minSceneDurations(SCENES),
};

export const REEL_EPARGNE_DURATION = totalFrames(reelEpargneDefaults.sceneDurations);

export const calculateReelEpargneMetadata = fitScenesToVoiceover<SceneKey, ReelEpargneProps>(
  REEL_EPARGNE_ID,
  SCENES,
);

/** Exemple : objectif d'épargne mensuel, progression sur 3 mois, appel à l'action. */
export const ReelEpargne: React.FC<ReelEpargneProps> = ({
  handle,
  monthlyGoal,
  months,
  showSafeZones,
  sceneDurations: d,
}) => {
  const perDay = Math.round(monthlyGoal / 30);
  const voiced = SCENES.some((s) => hasVoiceover(REEL_EPARGNE_ID, s.key));

  return (
    <ReelLayout showSafeZones={showSafeZones} duckMusic={voiced}>
      <Series>
        <Series.Sequence durationInFrames={d.hook}>
          <Scene durationInFrames={d.hook}>
            <VoiceOver reelId={REEL_EPARGNE_ID} sceneKey="hook" />
            <SafeArea>
              <KineticText
                text={`Comment épargner ${formatFCFA(monthlyGoal)} par mois ?`}
                highlight={[formatFCFA(monthlyGoal)]}
              />
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={d.goal}>
          <Scene durationInFrames={d.goal}>
            <VoiceOver reelId={REEL_EPARGNE_ID} sceneKey="goal" />
            <SafeArea gap={56}>
              <KineticText text="Ton objectif mensuel" {...TYPOGRAPHY.subtitle} />
              <AnimatedNumber value={monthlyGoal} startFrame={12} durationInFrames={50} />
              <KineticText
                text={`soit seulement ${formatFCFA(perDay)} par jour`}
                startFrame={80}
                framesPerWord={3}
                {...TYPOGRAPHY.body}
                color={COLORS.textMuted}
                highlight={[formatFCFA(perDay)]}
                highlightColor={COLORS.secondary}
              />
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={d.progress}>
          <Scene durationInFrames={d.progress}>
            <VoiceOver reelId={REEL_EPARGNE_ID} sceneKey="progress" />
            <SafeArea gap={64}>
              <KineticText text="Ta progression" {...TYPOGRAPHY.title} fontSize={96} />
              {months.map((month, i) => (
                <ProgressBar
                  key={month.label}
                  label={month.label}
                  progress={month.progress}
                  startFrame={20 + i * 24}
                  color={month.progress >= 100 ? COLORS.secondary : COLORS.primary}
                />
              ))}
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={d.cta}>
          <Scene durationInFrames={d.cta}>
            <VoiceOver reelId={REEL_EPARGNE_ID} sceneKey="cta" />
            <SafeArea>
              <CTA
                handle={handle}
                subtitle="Une astuce argent chaque semaine"
                title="Abonne-toi !"
              />
            </SafeArea>
          </Scene>
        </Series.Sequence>
      </Series>
    </ReelLayout>
  );
};
