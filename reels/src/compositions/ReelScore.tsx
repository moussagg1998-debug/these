import React from 'react';
import { Easing } from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import {
  CommentBubble,
  ConfettiBurst,
  CTA,
  Gauge,
  KineticText,
  QuestionOrb,
  ReelLayout,
  SafeArea,
  Scene,
  Sfx,
  Sparkles,
  Stars,
  VoiceOver,
  zoomBlur,
} from '../components';
import { COLORS, TRANSITION_FRAMES, TYPOGRAPHY, VIDEO } from '../theme';
import type { SceneDurations, SceneSpec } from '../voiceover';
import { fitScenesToVoiceover, hasVoiceover, minSceneDurations, totalFrames } from '../voiceover';

export const REEL_SCORE_ID = 'Reel-Score';

type SceneKey = 'hook' | 'gauge' | 'cta';

/** Durées minimales ; chaque scène s'allonge si sa voix off est plus longue. */
const SCENES: SceneSpec<SceneKey>[] = [
  { key: 'hook', minFrames: 90 },
  { key: 'gauge', minFrames: 160 },
  { key: 'cta', minFrames: 130 },
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

const transition = linearTiming({
  durationInFrames: TRANSITION_FRAMES,
  easing: Easing.inOut(Easing.cubic),
});

const GAUGE_START = 8;
const GAUGE_DURATION = 60;
const GAUGE_DONE = GAUGE_START + GAUGE_DURATION;
const STARS_START = GAUGE_DONE + 4;
const STAR_STAGGER = 8;
const BUBBLE_START = 34;
const BUBBLE_TYPING = 26;

/** Exemple : question d'accroche, score sur une jauge, appel à l'action. */
export const ReelScore: React.FC<ReelScoreProps> = ({
  handle,
  score,
  showSafeZones,
  sceneDurations: d,
}) => {
  const great = score >= 70;
  const stars = score >= 70 ? 3 : score >= 40 ? 2 : 1;
  const verdict = great ? 'Excellent ! Continue comme ça' : 'Tu peux faire mieux, on t’aide';
  const voiced = SCENES.some((s) => hasVoiceover(REEL_SCORE_ID, s.key));

  return (
    <ReelLayout showSafeZones={showSafeZones} duckMusic={voiced}>
      <TransitionSeries>
        {/* 1. Accroche : orbe « ? » avec pièces en orbite */}
        <TransitionSeries.Sequence durationInFrames={d.hook}>
          <Scene durationInFrames={d.hook} zoomTo={1.045}>
            <VoiceOver reelId={REEL_SCORE_ID} sceneKey="hook" />
            <Sfx name="pop" at={2} volume={0.5} />
            <SafeArea gap={40}>
              <QuestionOrb size={440} startFrame={0} />
              <KineticText
                text="Quel est ton score d’épargne ?"
                startFrame={8}
                highlight={['score']}
              />
            </SafeArea>
          </Scene>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={zoomBlur()} timing={transition} />

        {/* 2. Jauge, étoiles et confettis */}
        <TransitionSeries.Sequence durationInFrames={d.gauge}>
          <Scene durationInFrames={d.gauge} punches={[GAUGE_DONE]}>
            <VoiceOver reelId={REEL_SCORE_ID} sceneKey="gauge" />
            <Sfx name="whoosh" at={0} volume={0.45} />
            <Sfx name="ding" at={GAUGE_DONE} volume={0.4} />
            {Array.from({ length: stars }, (_, i) => (
              <Sfx key={i} name="pop" at={STARS_START + i * STAR_STAGGER} volume={0.45} />
            ))}
            {great ? (
              <Sfx name="success" at={STARS_START + stars * STAR_STAGGER} volume={0.4} />
            ) : null}
            <SafeArea gap={44}>
              <Gauge
                value={score}
                startFrame={GAUGE_START}
                durationInFrames={GAUGE_DURATION}
                size={720}
                label="Score d’épargne"
              />
              <Stars value={stars} startFrame={STARS_START} stagger={STAR_STAGGER} size={120} />
              <KineticText
                text={verdict}
                startFrame={80}
                {...TYPOGRAPHY.subtitle}
                highlight={['Excellent', 'mieux']}
                highlightColor={great ? COLORS.secondary : COLORS.primary}
              />
            </SafeArea>
            {great ? (
              <ConfettiBurst
                startFrame={GAUGE_DONE}
                x={VIDEO.width / 2 - 20}
                y={760}
                colors={[COLORS.secondary, COLORS.gold, COLORS.text]}
                seed="score"
              />
            ) : null}
            <Sparkles
              x={150}
              y={420}
              width={760}
              height={420}
              startFrame={GAUGE_DONE}
              seed="gauge"
            />
          </Scene>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={zoomBlur()} timing={transition} />

        {/* 3. Appel à l'action avec une bulle de commentaire */}
        <TransitionSeries.Sequence durationInFrames={d.cta}>
          <Scene durationInFrames={d.cta} punches={[BUBBLE_START + BUBBLE_TYPING]}>
            <VoiceOver reelId={REEL_SCORE_ID} sceneKey="cta" />
            <Sfx name="whoosh" at={0} volume={0.45} />
            <Sfx name="pop" at={BUBBLE_START} volume={0.4} />
            <Sfx name="pop" at={BUBBLE_START + BUBBLE_TYPING} volume={0.5} />
            <SafeArea gap={36}>
              <div style={{ alignSelf: 'flex-start', marginLeft: 24, minHeight: 140 }}>
                <CommentBubble
                  text={`J’ai ${score}/100 !`}
                  startFrame={BUBBLE_START}
                  typingFrames={BUBBLE_TYPING}
                />
              </div>
              <CTA
                handle={handle}
                subtitle="Calcule ton score en commentaire"
                title="Et toi ?"
                buttonLabel="Commenter"
                startFrame={4}
              />
            </SafeArea>
          </Scene>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </ReelLayout>
  );
};
