import React from 'react';
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_WEIGHTS } from '../../theme';
import { CoinShape } from './Coin';

type StampProps = {
  text: string;
  startFrame?: number;
  color?: string;
  fontSize?: number;
};

/** Tampon qui s'écrase sur l'écran (grand → taille normale) avec un petit tremblement. */
export const Stamp: React.FC<StampProps> = ({
  text,
  startFrame = 0,
  color = COLORS.secondary,
  fontSize = 56,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - startFrame;
  if (t < 0) return null;
  const hit = spring({ frame: t, fps, config: { damping: 14, stiffness: 260 } });
  const scale = interpolate(hit, [0, 1], [3, 1]);
  const shake = t < 10 ? (random(`stamp-${t}`) - 0.5) * 8 : 0;

  return (
    <div
      style={{
        transform: `translateX(${shake}px) rotate(-8deg) scale(${scale})`,
        opacity: Math.min(1, hit * 1.5),
        border: `8px solid ${color}`,
        color,
        borderRadius: 24,
        padding: '14px 36px',
        fontSize,
        fontWeight: FONT_WEIGHTS.black,
        letterSpacing: 2,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        background: `${COLORS.background}CC`,
        boxShadow: `0 0 60px ${color}55`,
      }}
    >
      {text}
    </div>
  );
};

type StarsProps = {
  /** Nombre d'étoiles allumées (sur `total`). */
  value: number;
  total?: number;
  startFrame?: number;
  /** Écart entre deux étoiles, en images. */
  stagger?: number;
  size?: number;
};

const STAR =
  'M 0 -50 L 14 -18 L 48 -15 L 22 8 L 30 42 L 0 24 L -30 42 L -22 8 L -48 -15 L -14 -18 Z';

/** Étoiles qui s'allument une à une avec un rebond. */
export const Stars: React.FC<StarsProps> = ({
  value,
  total = 3,
  startFrame = 0,
  stagger = 8,
  size = 130,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', gap: size * 0.2, alignItems: 'flex-end' }}>
      {Array.from({ length: total }, (_, i) => {
        const on = i < value;
        const pop = spring({
          frame: frame - startFrame - i * stagger,
          fps,
          config: { damping: 8, stiffness: 200 },
        });
        const scale = on ? interpolate(pop, [0, 1], [0.2, 1]) : 1;
        const lift = i === Math.floor(total / 2) ? -size * 0.25 : 0;
        return (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="-55 -55 110 110"
            style={{
              transform: `translateY(${lift}px) scale(${scale}) rotate(${(1 - pop) * 90}deg)`,
              overflow: 'visible',
            }}
          >
            <path d={STAR} fill={COLORS.track} />
            {on ? (
              <path
                d={STAR}
                fill={COLORS.gold}
                stroke={COLORS.primary}
                strokeWidth={4}
                strokeLinejoin="round"
                opacity={pop}
                style={{ filter: `drop-shadow(0 0 12px ${COLORS.gold})` }}
              />
            ) : null}
          </svg>
        );
      })}
    </div>
  );
};

/** Moment où la dernière étoile allumée apparaît. */
export const starsDoneFrame = (value: number, startFrame = 0, stagger = 8): number =>
  startFrame + Math.max(0, value - 1) * stagger;

type CommentBubbleProps = {
  /** Texte révélé après les points de saisie. */
  text: string;
  startFrame?: number;
  /** Durée des « … » avant le texte. */
  typingFrames?: number;
  handle?: string;
};

/** Bulle de commentaire : apparaît, montre « … » en train d'écrire, puis le texte. */
export const CommentBubble: React.FC<CommentBubbleProps> = ({
  text,
  startFrame = 0,
  typingFrames = 30,
  handle = '@toi',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - startFrame;
  const enter = spring({ frame: t, fps, config: { damping: 12, stiffness: 180 } });
  if (t < 0) return null;
  const typing = t < typingFrames;
  const reveal = spring({ frame: t - typingFrames, fps, config: { damping: 14 } });

  return (
    <div
      style={{
        position: 'relative',
        transform: `scale(${interpolate(enter, [0, 1], [0.4, 1])})`,
        transformOrigin: 'bottom left',
        opacity: enter,
        background: COLORS.text,
        color: COLORS.background,
        borderRadius: 36,
        borderBottomLeftRadius: 6,
        padding: '22px 34px',
        minWidth: 200,
        boxShadow: '0 20px 50px #00000080',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary }}>
        {handle}
      </div>
      {typing ? (
        <div style={{ display: 'flex', gap: 12, height: 56, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: COLORS.background,
                opacity: 0.35 + 0.65 * Math.max(0, Math.sin((t - i * 4) / 3)),
                transform: `translateY(${-6 * Math.max(0, Math.sin((t - i * 4) / 3))}px)`,
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 48, fontWeight: FONT_WEIGHTS.black, opacity: reveal }}>{text}</div>
      )}
    </div>
  );
};

type QuestionOrbProps = {
  size?: number;
  startFrame?: number;
};

/** Grand « ? » lumineux avec des pièces en orbite. */
export const QuestionOrb: React.FC<QuestionOrbProps> = ({ size = 420, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - startFrame;
  const enter = spring({ frame: t, fps, config: { damping: 10, stiffness: 140 } });
  const pulse = 1 + 0.04 * Math.sin(t / 6);

  return (
    <svg
      width={size}
      height={size}
      viewBox="-200 -200 400 400"
      style={{ overflow: 'visible', transform: `scale(${enter * pulse})` }}
    >
      <defs>
        <radialGradient id="orb" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFB566" />
          <stop offset="70%" stopColor={COLORS.primary} />
          <stop offset="100%" stopColor={COLORS.primaryDark} />
        </radialGradient>
      </defs>
      <circle r={150} fill={COLORS.primary} opacity={0.18} />
      <circle
        r={120}
        fill="url(#orb)"
        style={{ filter: `drop-shadow(0 0 40px ${COLORS.primary})` }}
      />
      <text
        y={58}
        textAnchor="middle"
        fontSize={190}
        fontWeight={900}
        fill={COLORS.text}
        style={{ fontFamily: 'inherit' }}
      >
        ?
      </text>
      {Array.from({ length: 4 }, (_, i) => {
        const angle = t / 18 + (i * Math.PI) / 2;
        const x = Math.cos(angle) * 185;
        const y = Math.sin(angle) * 70;
        const front = Math.sin(angle) > 0;
        return (
          <g
            key={i}
            transform={`translate(${x} ${y}) scale(${front ? 0.5 : 0.35})`}
            opacity={front ? 1 : 0.5}
          >
            <CoinShape spin={t / 8 + i} id={`orb-${i}`} />
          </g>
        );
      })}
    </svg>
  );
};
