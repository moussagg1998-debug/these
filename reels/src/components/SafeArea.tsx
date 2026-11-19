import React from 'react';
import { AbsoluteFill } from 'remotion';
import { SAFE_ZONE } from '../theme';

type SafeAreaProps = {
  children: React.ReactNode;
  /** Répartition verticale du contenu. */
  justify?: React.CSSProperties['justifyContent'];
  gap?: number;
  style?: React.CSSProperties;
};

/** Conteneur qui garde tout son contenu à l'intérieur des zones de sécurité. */
export const SafeArea: React.FC<SafeAreaProps> = ({
  children,
  justify = 'center',
  gap = 48,
  style,
}) => (
  <AbsoluteFill
    style={{
      paddingTop: SAFE_ZONE.top,
      paddingBottom: SAFE_ZONE.bottom,
      paddingLeft: SAFE_ZONE.left,
      paddingRight: SAFE_ZONE.right,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: justify,
      alignItems: 'center',
      gap,
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

const guideStyle: React.CSSProperties = {
  position: 'absolute',
  background: 'rgba(255, 0, 80, 0.28)',
  border: '2px dashed rgba(255, 0, 80, 0.9)',
  color: 'white',
  fontSize: 28,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
};

/** Affiche en rouge les zones recouvertes par l'interface (pour vérifier dans le Studio). */
export const SafeZoneGuides: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div style={{ ...guideStyle, top: 0, left: 0, right: 0, height: SAFE_ZONE.top }}>
      Zone haute ({SAFE_ZONE.top} px)
    </div>
    <div style={{ ...guideStyle, bottom: 0, left: 0, right: 0, height: SAFE_ZONE.bottom }}>
      Zone basse ({SAFE_ZONE.bottom} px)
    </div>
    <div
      style={{
        ...guideStyle,
        top: SAFE_ZONE.top,
        bottom: SAFE_ZONE.bottom,
        right: 0,
        width: SAFE_ZONE.right,
        writingMode: 'vertical-rl',
      }}
    >
      Boutons ({SAFE_ZONE.right} px)
    </div>
  </AbsoluteFill>
);
