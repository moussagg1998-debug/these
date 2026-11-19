import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { COLORS, VIDEO } from '../../theme';
import { CoinShape } from '../illustrations/Coin';

type ConfettiBurstProps = {
  /** Image du déclenchement (relative à la séquence). */
  startFrame: number;
  /** Point d'origine en pixels dans le cadre 1080 x 1920. */
  x?: number;
  y?: number;
  count?: number;
  colors?: string[];
  seed?: string;
};

/** Explosion de confettis : vitesse initiale, frottement de l'air, gravité, rotation. */
export const ConfettiBurst: React.FC<ConfettiBurstProps> = ({
  startFrame,
  x = VIDEO.width / 2,
  y = VIDEO.height / 2,
  count = 90,
  colors = [COLORS.primary, COLORS.secondary, COLORS.text, COLORS.gold],
  seed = 'confetti',
}) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0 || t > 90) return null;

  const drag = 0.9;
  const travel = (1 - Math.pow(drag, t)) / (1 - drag);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const angle = -Math.PI / 2 + (r('a') - 0.5) * Math.PI * 1.6;
        const speed = 22 + r('s') * 34;
        const px = x + Math.cos(angle) * speed * travel;
        const py = y + Math.sin(angle) * speed * travel + 0.55 * t * t * 0.5;
        const rotation = t * (r('r') - 0.5) * 30;
        const flip = Math.cos(t * (0.2 + r('f') * 0.3) + i);
        const w = 12 + r('w') * 10;
        const opacity = interpolate(t, [60, 90], [1, 0], { extrapolateLeft: 'clamp' });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: w,
              height: w * 1.7,
              borderRadius: r('shape') > 0.7 ? '50%' : 3,
              background: colors[Math.floor(r('c') * colors.length)],
              transform: `rotate(${rotation}deg) scaleY(${flip})`,
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

type SparklesProps = {
  /** Zone où scintillent les étoiles, en pixels dans le cadre. */
  x: number;
  y: number;
  width: number;
  height: number;
  startFrame?: number;
  count?: number;
  color?: string;
  seed?: string;
};

const SparkPath =
  'M 0 -1 C 0.12 -0.12 0.12 -0.12 1 0 C 0.12 0.12 0.12 0.12 0 1 C -0.12 0.12 -0.12 0.12 -1 0 C -0.12 -0.12 -0.12 -0.12 0 -1 Z';

/** Petites étoiles à 4 branches qui scintillent autour d'un élément. */
export const Sparkles: React.FC<SparklesProps> = ({
  x,
  y,
  width,
  height,
  startFrame = 0,
  count = 10,
  color = COLORS.gold,
  seed = 'sparkles',
}) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0) return null;

  return (
    <svg
      style={{ position: 'absolute', left: x, top: y, overflow: 'visible', pointerEvents: 'none' }}
      width={width}
      height={height}
    >
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const period = 24 + r('p') * 24;
        const phase = ((t + r('o') * period) % period) / period;
        const s = Math.sin(phase * Math.PI);
        const size = (10 + r('z') * 22) * s;
        return (
          <path
            key={i}
            d={SparkPath}
            fill={color}
            opacity={s}
            transform={`translate(${r('x') * width} ${r('y') * height}) scale(${size}) rotate(${t * 2})`}
          />
        );
      })}
    </svg>
  );
};

type FloatingCoinsProps = {
  count?: number;
  seed?: string;
};

/** Pièces floues qui montent lentement en arrière-plan (effet de profondeur). */
export const FloatingCoins: React.FC<FloatingCoinsProps> = ({ count = 9, seed = 'floating' }) => {
  const frame = useCurrentFrame();
  const span = VIDEO.height + 400;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const depth = 0.35 + r('d') * 0.65;
        const size = 60 + depth * 110;
        const speed = 1.2 + depth * 2.4;
        const y = VIDEO.height + 200 - ((frame * speed + r('o') * span) % span);
        const x = r('x') * VIDEO.width + Math.sin(frame / 40 + i) * 30;
        return (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="-50 -50 100 100"
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              opacity: 0.12 + depth * 0.22,
              filter: `blur(${(1 - depth) * 6}px)`,
            }}
          >
            <CoinShape spin={frame / 25 + i} id={`float-${i}`} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};
