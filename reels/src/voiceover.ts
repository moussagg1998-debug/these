import type { CalculateMetadataFunction } from 'remotion';
import { staticFile } from 'remotion';
import { VIDEO } from './theme';
import { hasStaticFile } from './utils/static-files';

/**
 * Voix off ElevenLabs.
 * Les clips sont dans public/voiceover/<id du Reel>/<scène>.mp3 (un fichier par scène).
 * Régénère-les avec `npm run voiceover` (voir voiceover/scripts.json).
 */
export const VOICE = {
  id: 's3TPKV1kjDlVtZbl4Ksh',
  name: 'Adam - Engaging, Friendly and Bright',
  model: 'eleven_v4',
} as const;

/** Délai avant que la voix démarre dans une scène, en images. */
export const VOICE_DELAY_FRAMES = 6;
/** Temps laissé après la fin de la voix avant de changer de scène, en images. */
const VOICE_TAIL_FRAMES = 12;

export const voiceoverFile = (reelId: string, sceneKey: string): string =>
  `voiceover/${reelId}/${sceneKey}.mp3`;

export const hasVoiceover = (reelId: string, sceneKey: string): boolean =>
  hasStaticFile(voiceoverFile(reelId, sceneKey));

/** Durée d'un fichier audio, lue par le navigateur. */
const getAudioDurationInSeconds = (src: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(audio.duration);
    audio.onerror = () => reject(new Error(`Impossible de lire ${src}`));
    audio.src = src;
  });

/** Scène d'un Reel : clé (= nom du clip de voix) et durée minimale en images. */
export type SceneSpec<K extends string> = { key: K; minFrames: number };

export type SceneDurations<K extends string> = Record<K, number>;

export const minSceneDurations = <K extends string>(scenes: SceneSpec<K>[]): SceneDurations<K> =>
  Object.fromEntries(scenes.map((s) => [s.key, s.minFrames])) as SceneDurations<K>;

export const totalFrames = (durations: Record<string, number>): number =>
  Object.values(durations).reduce((a, b) => a + b, 0);

/**
 * Allonge chaque scène pour que sa voix off tienne dedans,
 * puis règle la durée totale de la composition en conséquence.
 */
export const fitScenesToVoiceover =
  <K extends string, P extends { sceneDurations: SceneDurations<K> }>(
    reelId: string,
    scenes: SceneSpec<K>[],
  ): CalculateMetadataFunction<P> =>
  async ({ props }) => {
    const entries = await Promise.all(
      scenes.map(async ({ key, minFrames }) => {
        if (!hasVoiceover(reelId, key)) {
          return [key, minFrames] as const;
        }
        const seconds = await getAudioDurationInSeconds(staticFile(voiceoverFile(reelId, key)));
        const needed = VOICE_DELAY_FRAMES + Math.ceil(seconds * VIDEO.fps) + VOICE_TAIL_FRAMES;
        return [key, Math.max(minFrames, needed)] as const;
      }),
    );
    const sceneDurations = Object.fromEntries(entries) as SceneDurations<K>;

    return {
      durationInFrames: totalFrames(sceneDurations),
      props: { ...props, sceneDurations },
    };
  };
