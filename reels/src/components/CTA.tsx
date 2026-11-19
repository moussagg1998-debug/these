import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_WEIGHTS, SAFE_AREA, SPRINGS, TYPOGRAPHY } from '../theme';
import { hasStaticFile } from '../utils/static-files';

export const LOGO_FILE = 'logo.png';

type CTAProps = {
  /** Gros titre de l'appel à l'action. */
  title?: string;
  /** Pseudo du compte, ex. « @monpseudo ». */
  handle: string;
  /** Phrase sous le pseudo. */
  subtitle?: string;
  /** Texte du bouton. */
  buttonLabel?: string;
  /** Logo dans public/. Par défaut : public/logo.png s'il existe, sinon l'initiale du pseudo. */
  logoFile?: string;
  /** Image d'apparition (relative à la séquence). */
  startFrame?: number;
};

/** Bandeau final : appel à l'action, logo et pseudo. */
export const CTA: React.FC<CTAProps> = ({
  title = 'Abonne-toi !',
  handle,
  subtitle,
  buttonLabel = 'Suivre',
  logoFile = LOGO_FILE,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - startFrame, fps, config: SPRINGS.bounce });
  const translateY = interpolate(enter, [0, 1], [260, 0]);
  const opacity = interpolate(enter, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });

  const buttonEnter = spring({ frame: frame - startFrame - 12, fps, config: SPRINGS.bounce });
  const pulse = 1 + 0.04 * Math.sin(((frame - startFrame) / fps) * Math.PI * 2 * 1.1);
  const buttonScale = interpolate(buttonEnter, [0, 1], [0.5, 1]) * (buttonEnter > 0.95 ? pulse : 1);

  const initial = handle.replace(/^@/, '').charAt(0).toUpperCase() || '?';
  const logoSize = 150;

  return (
    <div
      style={{
        width: SAFE_AREA.width,
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 44,
        padding: '56px 48px',
        borderRadius: 48,
        background: COLORS.surface,
        border: `4px solid ${COLORS.primary}`,
        boxShadow: `0 0 80px ${COLORS.primary}40`,
      }}
    >
      <div style={{ ...TYPOGRAPHY.title, fontSize: 96, textAlign: 'center' }}>{title}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 32, maxWidth: '100%' }}>
        {hasStaticFile(logoFile) ? (
          <Img
            src={staticFile(logoFile)}
            style={{
              width: logoSize,
              height: logoSize,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: logoSize,
              height: logoSize,
              borderRadius: '50%',
              flexShrink: 0,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 76,
              fontWeight: FONT_WEIGHTS.black,
            }}
          >
            {initial}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ fontSize: 56, fontWeight: FONT_WEIGHTS.extrabold, color: COLORS.primary }}>
            {handle}
          </div>
          {subtitle ? (
            <div
              style={{
                fontSize: TYPOGRAPHY.caption.fontSize,
                fontWeight: FONT_WEIGHTS.semibold,
                color: COLORS.textMuted,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          transform: `scale(${buttonScale})`,
          background: COLORS.secondary,
          color: COLORS.background,
          fontSize: 54,
          fontWeight: FONT_WEIGHTS.black,
          padding: '24px 88px',
          borderRadius: 999,
          boxShadow: `0 12px 40px ${COLORS.secondary}66`,
        }}
      >
        {buttonLabel}
      </div>
    </div>
  );
};
