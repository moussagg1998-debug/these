import React from 'react';
import { Html5Audio, Sequence, staticFile } from 'remotion';
import { hasStaticFile } from '../../utils/static-files';

export type SfxName = 'whoosh' | 'coin' | 'pop' | 'ding' | 'success';

type SfxProps = {
  name: SfxName;
  /** Image de déclenchement (relative à la séquence). */
  at: number;
  volume?: number;
};

/** Bruitage ponctuel (public/sfx/<name>.mp3). Ne rend rien si le fichier manque. */
export const Sfx: React.FC<SfxProps> = ({ name, at, volume = 0.4 }) => {
  const file = `sfx/${name}.mp3`;
  if (!hasStaticFile(file)) {
    return null;
  }
  return (
    <Sequence from={Math.max(0, Math.round(at))} layout="none" name={`SFX · ${name}`}>
      <Html5Audio src={staticFile(file)} volume={volume} />
    </Sequence>
  );
};
