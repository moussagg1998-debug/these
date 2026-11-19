import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';

type ZoomBlurProps = {
  /** Flou maximal en pixels au milieu de la transition. */
  blur: number;
};

const ZoomBlurPresentation: React.FC<TransitionPresentationComponentProps<ZoomBlurProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  const entering = presentationDirection === 'entering';
  // La scène qui sort fonce vers la caméra, la nouvelle arrive du fond.
  const scale = entering ? interpolate(p, [0, 1], [0.55, 1]) : interpolate(p, [0, 1], [1, 2.2]);
  const blur = (entering ? 1 - p : p) * passedProps.blur;
  const opacity = entering
    ? interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' })
    : interpolate(p, [0.5, 1], [1, 0], { extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity }}>
      {children}
    </AbsoluteFill>
  );
};

/** Transition « zoom à travers » : la scène part en zoom flouté, la suivante surgit. */
export const zoomBlur = (
  props: Partial<ZoomBlurProps> = {},
): TransitionPresentation<ZoomBlurProps> => ({
  component: ZoomBlurPresentation,
  props: { blur: 24, ...props },
});
