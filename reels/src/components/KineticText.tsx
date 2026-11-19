import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, SPRINGS, TYPOGRAPHY } from '../theme';

type KineticTextProps = {
  text: string;
  /** Image où le premier mot apparaît (relative à la séquence). */
  startFrame?: number;
  /** Écart entre deux mots, en images. */
  framesPerWord?: number;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  color?: string;
  /** Mots (ou groupes liés par une espace insécable) à colorer, sans tenir compte de la casse ni de la ponctuation. */
  highlight?: string[];
  highlightColor?: string;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
};

const normalize = (word: string): string =>
  word
    .replace(/ /g, ' ')
    .replace(/[.,!?;:«»"'’()]/g, '')
    .trim()
    .toLowerCase();

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

/**
 * Texte qui apparaît mot par mot avec un léger rebond.
 * Seules les espaces normales séparent les mots : utilise une espace insécable ( )
 * pour garder « 15 000 FCFA » ensemble.
 */
export const KineticText: React.FC<KineticTextProps> = ({
  text,
  startFrame = 0,
  framesPerWord = 4,
  fontSize = TYPOGRAPHY.title.fontSize,
  fontWeight = TYPOGRAPHY.title.fontWeight,
  lineHeight = TYPOGRAPHY.title.lineHeight,
  color = COLORS.text,
  highlight = [],
  highlightColor = COLORS.primary,
  align = 'center',
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/[ \t\n]+/).filter(Boolean);
  const highlighted = new Set(highlight.map(normalize));

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: JUSTIFY[align],
        columnGap: fontSize * 0.26,
        rowGap: fontSize * (lineHeight - 1),
        fontSize,
        fontWeight,
        lineHeight,
        textAlign: align,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const progress = spring({
          frame: frame - startFrame - i * framesPerWord,
          fps,
          config: SPRINGS.bounce,
        });
        const opacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' });
        const translateY = interpolate(progress, [0, 1], [fontSize * 0.5, 0]);
        const scale = interpolate(progress, [0, 1], [0.6, 1]);

        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              opacity,
              transform: `translateY(${translateY}px) scale(${scale})`,
              color: highlighted.has(normalize(word)) ? highlightColor : color,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
