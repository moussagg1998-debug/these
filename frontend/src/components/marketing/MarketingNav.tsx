// Shared nav for Landing Page + Terms (identical chrome in the Banani
// source for both screens — extracted per "pattern appears twice, extract
// now" rule). Banani only shipped a desktop nav; the hamburger + slide-down
// panel below is this project's mobile-first addition.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

const LINKS = [
  { href: '/#fonctionnalites', label: 'Fonctionnalités' },
  { href: '/#tarifs', label: 'Tarifs' },
  { href: '/#temoignages', label: 'Témoignages' },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="border-b border-border bg-background px-4 py-4 sm:px-8 lg:px-16">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary sm:h-8 sm:w-8">
            <Icon i="graduation-cap" size={16} className="text-primary-foreground" />
          </div>
          <span className="font-headings text-base font-semibold text-foreground sm:text-lg">
            ThèseFacile
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-foreground"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Essai gratuit
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-sm border border-border lg:hidden"
        >
          <Icon i={open ? 'x' : 'sliders'} size={18} className="text-foreground" />
        </button>
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 lg:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground">
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            className="rounded-sm border border-border px-4 py-3 text-center text-sm font-medium text-foreground"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="rounded-sm bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground"
          >
            Essai gratuit
          </Link>
        </div>
      )}
    </nav>
  );
}
