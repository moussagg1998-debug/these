// Base loading placeholder — a shimmering bar/block. Compose with Tailwind
// width/height/rounded utilities via `className` to match the shape of the
// real content it stands in for (text line, avatar circle, card, table row).
// Falls back to a plain pulse for prefers-reduced-motion (the gradient sweep
// reads as continuous horizontal motion, which motion-safe: is meant to gate).
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded-sm bg-muted bg-[length:200%_100%] motion-safe:animate-shimmer motion-reduce:animate-pulse ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, var(--color-muted) 25%, var(--color-input) 50%, var(--color-muted) 75%)',
      }}
    />
  );
}
