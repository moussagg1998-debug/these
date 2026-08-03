// Replaces Banani's `@global/UserAvatar` (a photo-illustration service this
// project doesn't have). Renders initials in a colored circle instead —
// an honest downgrade rather than faking photorealistic avatars. See
// .planning/banani/phase-2-auth-onboarding.md § Component breakdown.
interface AvatarProps {
  name: string;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, className = 'h-8 w-8' }: AvatarProps) {
  return (
    <div
      className={`${className} shrink-0 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold font-headings`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
