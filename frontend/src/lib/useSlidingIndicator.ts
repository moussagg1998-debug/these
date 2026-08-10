'use client';

// Measures the active tab/segment's position within its container so a
// single absolutely-positioned "indicator" element can slide/resize to it
// via a CSS transition, instead of every tab re-rendering its own instant
// background/border swap. Shared by every tab-style control in the app
// (FilterBar, the Settings tabs, AuthModeToggle) — same technique, different
// visual skin (underline vs filled pill) per caller.
import { useLayoutEffect, useRef, useState, useCallback } from 'react';

interface IndicatorRect {
  left: number;
  width: number;
}

interface UseSlidingIndicatorResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  registerItem: (key: string) => (el: HTMLElement | null) => void;
  style: IndicatorRect;
  ready: boolean;
}

export function useSlidingIndicator(activeKey: string): UseSlidingIndicatorResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(new Map<string, HTMLElement>());
  const [style, setStyle] = useState<IndicatorRect>({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const active = itemsRef.current.get(activeKey);
    if (!container || !active) return;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setStyle({ left: activeRect.left - containerRect.left, width: activeRect.width });
    setReady(true);
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const registerItem = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) itemsRef.current.set(key, el);
      else itemsRef.current.delete(key);
    },
    [],
  );

  return { containerRef, registerItem, style, ready };
}
