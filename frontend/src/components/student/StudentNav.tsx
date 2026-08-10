// Banani student screens (`Dashboard Étudiant`, `Dépôt de fichier étudiant`,
// `Messagerie étudiant-encadrant`, `Documents`, `Commentaires`,
// `Calendrier`) all share this exact top nav. "Documents"/"Commentaires"/
// "Calendrier" now link to real per-thesis pages (previously inert
// `Bientôt disponible` spans — see the 2026-08-05 student-dashboard-pages
// spec). The notification bell now opens a real dropdown via
// NotificationBell instead of only showing a static count badge.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { NotificationBell } from './NotificationBell';
import { useUser } from '@/contexts/AuthContext';

interface StudentNavProps {
  name: string;
  active?: 'dashboard' | 'documents' | 'comments' | 'deadlines' | 'settings';
}

const NAV_LINKS: {
  id: 'documents' | 'comments' | 'deadlines' | 'settings';
  href: string;
  label: string;
}[] = [
  { id: 'documents', href: '/documents', label: 'Documents' },
  { id: 'comments', href: '/comments', label: 'Commentaires' },
  { id: 'deadlines', href: '/deadlines', label: 'Calendrier' },
  { id: 'settings', href: '/settings', label: 'Paramètres' },
];

export function StudentNav({ name, active }: StudentNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useUser();

  return (
    <nav className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="md:hidden text-foreground transition duration-150 motion-safe:active:scale-90"
        >
          <Icon i="menu" size={20} />
        </button>
        <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
            <Icon i="graduation-cap" size={14} className="text-primary-foreground" />
          </div>
          <span className="hidden sm:inline text-base font-semibold font-headings text-foreground">
            ThèseFacile
          </span>
        </Link>
      </div>

      <div className="hidden md:flex items-center gap-6 text-sm font-medium">
        <Link
          href="/dashboard"
          className={`transition-colors duration-150 ${
            active === 'dashboard'
              ? 'text-primary border-b-2 border-primary pb-0.5'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Mon mémoire
        </Link>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            className={`transition-colors duration-150 ${
              active === link.id
                ? 'text-primary border-b-2 border-primary pb-0.5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border">
          <Avatar name={name} src={user?.avatarUrl} className="h-8 w-8" />
          <div className="text-xs font-semibold text-foreground">{name}</div>
        </div>
        <LogoutButton
          iconOnly
          className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
        />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 bg-surface flex flex-col motion-safe:animate-slide-in-left">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="font-headings font-semibold text-foreground">ThèseFacile</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="transition duration-150 motion-safe:active:scale-90"
              >
                <Icon i="x" size={18} className="text-foreground" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
              <Link
                href="/dashboard"
                onClick={() => setDrawerOpen(false)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition duration-150 ${
                  active === 'dashboard'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground opacity-70 hover:opacity-100'
                }`}
              >
                Mon mémoire
              </Link>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition duration-150 ${
                    active === link.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground opacity-70 hover:opacity-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-border">
              <LogoutButton className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-foreground opacity-70 transition-opacity duration-150 hover:opacity-100" />
            </div>
          </div>
          <button
            type="button"
            className="flex-1 bg-black/40 motion-safe:animate-fade-in"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}
    </nav>
  );
}
