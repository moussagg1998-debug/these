'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Remounts on every pathname change so the existing slide-up keyframe
// (globals.css --animate-slide-up) replays as a page-enter transition.
// motion-safe: respects prefers-reduced-motion, same recipe as the rest
// of the app's interactive feedback.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="motion-safe:animate-slide-up">
      {children}
    </div>
  );
}
