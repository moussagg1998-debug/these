// Segmented "Se connecter" / "Créer un compte" switcher shown at the top of
// the /login and /signup form panels — two distinct, equally-weighted entry
// points rather than one primary action + a small text link. Each option
// is a real navigation link (separate routes), not client-side tab state.
'use client';

import Link from 'next/link';
import { useSlidingIndicator } from '@/lib/useSlidingIndicator';

interface AuthModeToggleProps {
  mode: 'login' | 'signup';
}

export function AuthModeToggle({ mode }: AuthModeToggleProps) {
  const { containerRef, registerItem, style, ready } = useSlidingIndicator(mode);

  return (
    <div
      ref={containerRef}
      className="relative mb-5 flex gap-1 rounded-sm border border-border bg-input p-1"
    >
      <div
        aria-hidden
        className={`absolute inset-y-1 rounded-sm bg-primary transition-[left,width] duration-250 ease-out ${ready ? 'opacity-100' : 'opacity-0'}`}
        style={{ left: style.left, width: style.width }}
      />
      <Link
        href="/login"
        ref={registerItem('login')}
        aria-current={mode === 'login' ? 'page' : undefined}
        className={`relative z-10 flex-1 rounded-sm py-2 text-center text-xs font-medium transition-colors duration-150 sm:text-sm ${
          mode === 'login'
            ? 'text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Se connecter
      </Link>
      <Link
        href="/signup"
        ref={registerItem('signup')}
        aria-current={mode === 'signup' ? 'page' : undefined}
        className={`relative z-10 flex-1 rounded-sm py-2 text-center text-xs font-medium transition-colors duration-150 sm:text-sm ${
          mode === 'signup'
            ? 'text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Créer un compte
      </Link>
    </div>
  );
}
