// Shared animated tooltip. Wraps its trigger in a non-disabled span so
// hover still fires even when the trigger itself is a disabled <button>
// (disabled form controls don't reliably dispatch mouse events across
// browsers) — used across the app to replace native title="Bientôt
// disponible" tooltips on "coming soon" controls with a real animated one.
// Pass no `label` (undefined/null) to render children inert, unwrapped.
'use client';

import { useState, type ReactNode } from 'react';

interface TooltipProps {
  label?: string | null | undefined;
  children: ReactNode;
  side?: 'top' | 'right';
  className?: string;
}

export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  if (!label) return <>{children}</>;

  const positionClass =
    side === 'right'
      ? 'left-full top-1/2 ml-2 -translate-y-1/2'
      : 'bottom-full left-1/2 mb-2 -translate-x-1/2';

  const hiddenTransformClass =
    side === 'right' ? '-translate-x-1 -translate-y-1/2' : 'translate-y-1 -translate-x-1/2';
  const visibleTransformClass = side === 'right' ? '-translate-y-1/2' : '-translate-x-1/2';

  const arrowClass =
    side === 'right'
      ? 'right-full top-1/2 -translate-y-1/2 border-r-surface'
      : 'left-1/2 top-full -translate-x-1/2 border-t-surface';

  return (
    <span
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-sm border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition duration-150 ${positionClass} ${
          visible ? `opacity-100 ${visibleTransformClass}` : `opacity-0 ${hiddenTransformClass}`
        }`}
      >
        {label}
        <span className={`absolute h-0 w-0 border-4 border-transparent ${arrowClass}`} />
      </span>
    </span>
  );
}
