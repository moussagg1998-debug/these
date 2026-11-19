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
} from '../components';
import { COLORS, TYPOGRAPHY } from '../theme';
import { formatFCFA } from '../utils/format';

export type ReelEpargneProps = {
  handle: string;
  /** Objectif d'épargne mensuel en FCFA. */
  monthlyGoal: number;
  /** Progression de chaque mois, de 0 à 100. */
  months: { label: string; progress: number }[];
  showSafeZones: boolean;
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
};

const SCENES = { hook: 90, goal: 120, progress: 120, cta: 120 } as const;
export const REEL_EPARGNE_DURATION = Object.values(SCENES).reduce((a, b) => a + b, 0);

/** Exemple : objectif d'épargne mensuel, progression sur 3 mois, appel à l'action. */
export const ReelEpargne: React.FC<ReelEpargneProps> = ({
  handle,
  monthlyGoal,
  months,
  showSafeZones,
}) => {
  const perDay = Math.round(monthlyGoal / 30);

  return (
    <ReelLayout showSafeZones={showSafeZones}>
      <Series>
        <Series.Sequence durationInFrames={SCENES.hook}>
          <Scene durationInFrames={SCENES.hook}>
            <SafeArea>
              <KineticText
                text={`Comment épargner ${formatFCFA(monthlyGoal)} par mois ?`}
                highlight={[formatFCFA(monthlyGoal)]}
              />
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.goal}>
          <Scene durationInFrames={SCENES.goal}>
            <SafeArea gap={56}>
              <KineticText text="Ton objectif mensuel" {...TYPOGRAPHY.subtitle} />
              <AnimatedNumber value={monthlyGoal} startFrame={12} durationInFrames={50} />
              <KineticText
                text={`soit seulement ${formatFCFA(perDay)} par jour`}
                startFrame={70}
                framesPerWord={3}
                {...TYPOGRAPHY.body}
                color={COLORS.textMuted}
                highlight={[formatFCFA(perDay)]}
                highlightColor={COLORS.secondary}
              />
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.progress}>
          <Scene durationInFrames={SCENES.progress}>
            <SafeArea gap={64}>
              <KineticText text="Ta progression" {...TYPOGRAPHY.title} fontSize={96} />
              {months.map((month, i) => (
                <ProgressBar
                  key={month.label}
                  label={month.label}
                  progress={month.progress}
                  startFrame={20 + i * 18}
                  color={month.progress >= 100 ? COLORS.secondary : COLORS.primary}
                />
              ))}
            </SafeArea>
          </Scene>
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.cta}>
          <Scene durationInFrames={SCENES.cta}>
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
