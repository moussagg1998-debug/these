// Banani student screens (`Dashboard Étudiant`, `Dépôt de fichier étudiant`,
// `Messagerie étudiant-encadrant`, `Documents`, `Commentaires`,
// `Calendrier`) all share this exact top nav. "Documents"/"Commentaires"/
// "Calendrier" now link to real per-thesis pages (previously inert
// `Bientôt disponible` spans — see the 2026-08-05 student-dashboard-pages
// spec). The notification bell now opens a real dropdown via
// NotificationBell instead of only showing a static count badge.
'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from './NotificationBell';

interface StudentNavProps {
  name: string;
  active?: 'dashboard' | 'documents' | 'comments' | 'deadlines';
}

const NAV_LINKS: { id: 'documents' | 'comments' | 'deadlines'; href: string; label: string }[] = [
  { id: 'documents', href: '/documents', label: 'Documents' },
  { id: 'comments', href: '/comments', label: 'Commentaires' },
  { id: 'deadlines', href: '/deadlines', label: 'Calendrier' },
];

export function StudentNav({ name, active }: StudentNavProps) {
  return (
    <nav className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
      <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
          <Icon i="graduation-cap" size={14} className="text-primary-foreground" />
        </div>
        <span className="hidden sm:inline text-base font-semibold font-headings text-foreground">
          ThèseFacile
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-6 text-sm font-medium">
        <Link
          href="/dashboard"
          className={
            active === 'dashboard'
              ? 'text-primary border-b-2 border-primary pb-0.5'
              : 'text-muted-foreground'
          }
        >
          Mon mémoire
        </Link>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            className={
              active === link.id
                ? 'text-primary border-b-2 border-primary pb-0.5'
                : 'text-muted-foreground'
            }
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border">
          <Avatar name={name} className="h-8 w-8" />
          <div className="text-xs font-semibold text-foreground">{name}</div>
        </div>
      </div>
    </nav>
  );
}
