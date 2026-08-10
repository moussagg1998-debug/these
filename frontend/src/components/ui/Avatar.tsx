// Replaces Banani's `@global/UserAvatar` (a photo-illustration service this
// project doesn't have). Renders initials in a colored circle instead —
// an honest downgrade rather than faking photorealistic avatars. See
// .planning/banani/phase-2-auth-onboarding.md § Component breakdown.
'use client';

import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ImageLightbox } from '@/components/ui/ImageLightbox';

interface AvatarProps {
  name: string;
  /** Real photo URL (e.g. Google OAuth picture, or an uploaded avatar). Falls back to initials when absent. */
  src?: string | null | undefined;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, className = 'h-8 w-8' }: AvatarProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (src) {
    // Avatars often sit inside an already-clickable row (a Link to the
    // student's page, a conversation-select button, a recipient <label>) —
    // preventDefault + stopPropagation keeps "view photo" from also
    // triggering that ancestor's navigation/selection.
    function openLightbox(e: MouseEvent | KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      setLightboxOpen(true);
    }
    return (
      <>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Voir la photo de ${name}`}
          onClick={openLightbox}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') openLightbox(e);
          }}
          className={`${className} shrink-0 inline-block overflow-hidden rounded-full cursor-pointer transition duration-150 hover:opacity-85 motion-safe:active:scale-95`}
        >
          <img src={src} alt={name} className="h-full w-full object-cover" />
        </span>
        {lightboxOpen && (
          <ImageLightbox src={src} alt={name} onClose={() => setLightboxOpen(false)} />
        )}
      </>
    );
  }
  return (
    <div
      className={`${className} shrink-0 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold font-headings`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
