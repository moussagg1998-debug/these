import React from 'react';
import { Easing } from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import {
  AnimatedNumber,
  coinImpactFrames,
  CoinStacks,
  ConfettiBurst,
  CTA,
  KineticText,
  PiggyBank,
  ProgressBar,
  ReelLayout,
  SafeArea,
  Scene,
  Sfx,
  Slam,
  Sparkles,
  Stamp,
  Trophy,
  VoiceOver,
  zoomBlur,
} from '../components';
import { COLORS, TRANSITION_FRAMES, TYPOGRAPHY, VIDEO } from '../theme';
import { formatFCFA } from '../utils/format';
import type { SceneDurations, SceneSpec } from '../voiceover';
import { fitScenesToVoiceover, hasVoiceover, minSceneDurations, totalFrames } from '../voiceover';

export const REEL_EPARGNE_ID = 'Reel-Epargne';

type SceneKey = 'hook' | 'goal' | 'progress' | 'cta';

/** Durées minimales ; chaque scène s'allonge si sa voix off est plus longue. */
const SCENES: SceneSpec<SceneKey>[] = [
  { key: 'hook', minFrames: 100 },
  { key: 'goal', minFrames: 130 },
  { key: 'progress', minFrames: 150 },
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

const transition = linearTiming({
  durationInFrames: TRANSITION_FRAMES,
  easing: Easing.inOut(Easing.cubic),
});

// Timings internes des scènes (en images depuis le début de la scène).
const COIN_DROPS = [26, 34, 42, 50, 58, 66];
const COIN_IMPACTS = coinImpactFrames(COIN_DROPS);
const NUMBER_START = 10;
const NUMBER_DURATION = 45;
const NUMBER_DONE = NUMBER_START + NUMBER_DURATION;
const PER_DAY_AT = 84;
const BAR_STARTS = [20, 46, 76];
const BAR_DURATION = 40;
const GOAL_REACHED = BAR_STARTS[2]! + BAR_DURATION;

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
  // Célébration (trophée, tampon, confettis) quand le dernier mois atteint 100 %.
  const allDone = (months.at(-1)?.progress ?? 0) >= 100;

  return (
    <ReelLayout showSafeZones={showSafeZones} duckMusic={voiced}>
      <TransitionSeries>
        {/* 1. Accroche : la tirelire avale des pièces */}
        <TransitionSeries.Sequence durationInFrames={d.hook}>
          <Scene durationInFrames={d.hook} punches={[COIN_IMPACTS.at(-1)!]}>
            <VoiceOver reelId={REEL_EPARGNE_ID} sceneKey="hook" />
            {COIN_IMPACTS.map((at) => (
              <Sfx key={at} name="coin" at={at} volume={0.3} />
            ))}
            <SafeArea gap={24}>
              <KineticText
                text={`Comment épargner ${formatFCFA(monthlyGoal)} par mois ?`}
                startFrame={4}
                highlight={[formatFCFA(monthlyGoal)]}
              />
              <PiggyBank width={500} startFrame={0} coinDrops={COIN_DROPS} />
            </SafeArea>
            <Sparkles
              x={220}
              y={1000}
              width={640}
              height={420}
              startFrame={COIN_IMPACTS[0]!}
              seed="piggy"
            />
          </Scene>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={zoomBlur()} timing={transition} />

        {/* 2. Objectif : le montant arrive en gros plan, les piles de pièces montent */}
        <TransitionSeries.Sequence durationInFrames={d.goal}>
          <Scene durationInFrames={d.goal} punches={[NUMBER_DONE, PER_DAY_AT]}>
            <VoiceOver reelId={REEL_EPARGNE_ID} sceneKey="goal" />
            <Sfx name="whoosh" at={0} volume={0.45} />
            <Sfx name="ding" at={NUMBER_DONE} volume={0.4} />
            <Sfx name="pop" at={PER_DAY_AT} volume={0.5} />
            <SafeArea gap={40}>
              <KineticText text="Ton objectif mensuel" startFrame={2} {...TYPOGRAPHY.subtitle} />
              <Slam startFrame={NUMBER_START - 4}>
                <AnimatedNumber
                  value={monthlyGoal}
                  startFrame={NUMBER_START}
                  durationInFrames={NUMBER_DURATION}
                />
              </Slam>
              <CoinStacks stacks={[4, 7, 10]} startFrame={14} framesPerCoin={2} width={520} />
              <KineticText
                text={`soit seulement ${formatFCFA(perDay)} par jour`}
                startFrame={PER_DAY_AT}
                framesPerWord={3}
                {...TYPOGRAPHY.body}
                color={COLORS.textMuted}
                highlight={[formatFCFA(perDay)]}
                highlightColor={COLORS.secondary}
              />
            </SafeArea>
            <Sparkles
              x={160}
              y={560}
              width={760}
              height={260}
              startFrame={NUMBER_DONE}
              seed="number"
            />
          </Scene>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={zoomBlur()} timing={transition} />

        {/* 3. Progression : les barres se remplissent, explosion au 3e mois */}
        <TransitionSeries.Sequence durationInFrames={d.progress}>
          <Scene durationInFrames={d.progress} punches={[GOAL_REACHED]}>
            <VoiceOver reelId={REEL_EPARGNE_ID} sceneKey="progress" />
            <Sfx name="whoosh" at={0} volume={0.45} />
            {allDone ? (
              <>
                <Sfx name="success" at={GOAL_REACHED} volume={0.45} />
                <Sfx name="pop" at={GOAL_REACHED + 4} volume={0.5} />
              </>
            ) : null}
            <SafeArea gap={44}>
              <KineticText
                text="Ta progression"
                startFrame={2}
                {...TYPOGRAPHY.title}
                fontSize={96}
              />
              {months.map((month, i) => (
                <ProgressBar
                  key={month.label}
                  label={month.label}
                  progress={month.progress}
                  startFrame={BAR_STARTS[i] ?? 20 + i * 28}
                  durationInFrames={BAR_DURATION}
                  color={month.progress >= 100 ? COLORS.secondary : COLORS.primary}
                />
              ))}
              {allDone ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: 330,
                  }}
                >
                  <Trophy size={230} startFrame={GOAL_REACHED} />
                  <div style={{ marginTop: -30 }}>
                    <Stamp text="Objectif atteint !" startFrame={GOAL_REACHED + 4} />
                  </div>
                </div>
              ) : null}
            </SafeArea>
            {allDone ? (
              <ConfettiBurst
                startFrame={GOAL_REACHED}
                x={VIDEO.width / 2 - 20}
                y={1250}
                seed="goal"
              />
            ) : null}
          </Scene>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={zoomBlur()} timing={transition} />

        {/* 4. Appel à l'action */}
        <TransitionSeries.Sequence durationInFrames={d.cta}>
          <Scene durationInFrames={d.cta} punches={[18]}>
            <VoiceOver reelId={REEL_EPARGNE_ID} sceneKey="cta" />
            <Sfx name="whoosh" at={0} volume={0.45} />
            <Sfx name="pop" at={18} volume={0.5} />
            <SafeArea>
              <CTA
                handle={handle}
                subtitle="Une astuce argent chaque semaine"
                title="Abonne-toi !"
                startFrame={4}
              />
            </SafeArea>
            <Sparkles x={130} y={620} width={780} height={680} startFrame={20} seed="cta" />
          </Scene>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </ReelLayout>
  );
};
