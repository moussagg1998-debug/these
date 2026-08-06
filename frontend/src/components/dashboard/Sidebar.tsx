// Banani `Sidebar.jsx` — left nav for the Encadrant back-office. Highlights
// the active section via the current pathname instead of a hardcoded prop.
// Documents/Commentaires/Échéances/Paramètres are real links even though
// their pages don't exist until Phases 4/5/7 — a 404 while mid-build is more
// honest than a disabled link pretending the feature isn't planned.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { isNavItemActive } from '@/lib/nav-active';

export const NAV_ITEMS = [
  { href: '/dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
  { href: '/students', icon: 'users', label: 'Mes étudiants' },
  { href: '/documents', icon: 'file-text', label: 'Documents' },
  { href: '/comments', icon: 'message-square', label: 'Commentaires' },
  { href: '/deadlines', icon: 'calendar', label: 'Échéances' },
  { href: '/messages', icon: 'message-circle', label: 'Messages' },
  { href: '/settings', icon: 'settings', label: 'Paramètres' },
];

interface SidebarProps {
  name: string;
  subtitle?: string | undefined;
}

export function Sidebar({ name, subtitle = 'Encadrant' }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="hidden lg:flex flex-col w-56 shrink-0 bg-primary h-full">
      <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(245,243,238,0.15)' }}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-sm flex items-center justify-center">
            <Icon i="book-open" size={14} className="text-accent-foreground" />
          </div>
          <span className="font-headings font-semibold text-base text-primary-foreground tracking-tight">
            ThèseFacile
          </span>
        </Link>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition duration-150 ${
                isActive
                  ? 'bg-primary-foreground text-primary'
                  : 'text-primary-foreground opacity-70 hover:opacity-100'
              }`}
            >
              <Icon i={item.icon} size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(245,243,238,0.15)' }}>
        <div className="flex items-center gap-3">
          <Avatar name={name} className="h-8 w-8" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-primary-foreground truncate">{name}</div>
            <div className="text-xs text-primary-foreground opacity-60 truncate">{subtitle}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
