import React from 'react';
import { Html5Audio, Sequence, staticFile } from 'remotion';
import { hasVoiceover, VOICE_DELAY_FRAMES, voiceoverFile } from '../voiceover';

type VoiceOverProps = {
  /** Identifiant du Reel (ex. « Reel-Epargne »). */
  reelId: string;
  /** Scène : lit public/voiceover/<reelId>/<sceneKey>.mp3. */
  sceneKey: string;
  volume?: number;
};

/** Joue le clip de voix off de la scène s'il existe, sinon ne rend rien. */
export const VoiceOver: React.FC<VoiceOverProps> = ({ reelId, sceneKey, volume = 1 }) => {
  if (!hasVoiceover(reelId, sceneKey)) {
    return null;
  }

  return (
    <Sequence from={VOICE_DELAY_FRAMES} layout="none" name={`Voix off · ${sceneKey}`}>
      <Html5Audio src={staticFile(voiceoverFile(reelId, sceneKey))} volume={volume} />
    </Sequence>
  );
};
