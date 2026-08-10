// Full-screen in-app viewer for message-attachment images — replaces
// `target="_blank"` links to the raw Cloudinary URL so tapping a photo
// never leaves the app.
'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8 motion-safe:animate-fade-in"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute top-4 right-4 text-white/80 transition duration-150 hover:text-white motion-safe:active:scale-90"
      >
        <Icon i="x" size={24} />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-md object-contain motion-safe:animate-scale-in"
      />
    </div>
  );
}
