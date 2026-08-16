'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  /** Rendered as-is (no animation) when it isn't a plain integer string. */
  value: string;
  className?: string;
}

const DURATION_MS = 600;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const target = Number(value);
  const isAnimatable =
    value.trim() !== '' && Number.isFinite(target) && value.trim() === String(target);
  const [display, setDisplay] = useState(isAnimatable ? 0 : target);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!isAnimatable) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      setDisplay(Math.round(from + (target - from) * easeOutCubic(progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, isAnimatable]);

  if (!isAnimatable) return <span className={className}>{value}</span>;
  return <span className={className}>{display}</span>;
}
