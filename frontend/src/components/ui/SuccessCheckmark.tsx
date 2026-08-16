// Animated checkmark for success feedback (e.g. the success toast) — circle
// scales in, then the check stroke draws itself. `pathLength="1"` normalizes
// the dash math regardless of the path's actual on-screen length. Falls back
// to a fully-drawn, static checkmark under prefers-reduced-motion since the
// animation classes are motion-safe-gated.
export function SuccessCheckmark({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} shrink-0 motion-safe:animate-scale-in`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 12.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        strokeDasharray="1"
        className="motion-safe:animate-check-draw"
      />
    </svg>
  );
}
