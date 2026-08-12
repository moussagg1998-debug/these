'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PricingCTAProps {
  href: string;
  /** Where an already-authenticated visitor goes instead of `href`. */
  loggedInHref?: string | undefined;
  className: string;
  children: ReactNode;
}

/**
 * Swaps the pricing card's target for an already-authenticated visitor
 * landing on the public marketing page: anonymous → `href` (e.g. /signup,
 * unchanged) ; logged in → `loggedInHref` (straight to the real Chariow
 * upgrade flow instead of a signup form they don't need).
 *
 * `useAuth()`, not `useUser()` — `useUser()` force-redirects anonymous
 * visitors to /login, which would break this public page.
 */
export function PricingCTA({ href, loggedInHref, className, children }: PricingCTAProps) {
  const { user, loading } = useAuth();
  const target = !loading && user && loggedInHref ? loggedInHref : href;
  return (
    <Link href={target} className={className}>
      {children}
    </Link>
  );
}
