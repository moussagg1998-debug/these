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
import { LogoutButton } from '@/components/ui/LogoutButton';
import { isNavItemActive } from '@/lib/nav-active';
import { useUser } from '@/contexts/AuthContext';

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
  const user = useUser();

  return (
    <div className="hidden lg:flex flex-col w-56 shrink-0 bg-surface border-r border-border h-full">
      <div className="px-6 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-sm flex items-center justify-center">
            <Icon i="book-open" size={14} className="text-accent-foreground" />
          </div>
          <span className="font-headings font-semibold text-base text-foreground tracking-tight">
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
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground opacity-70 hover:opacity-100'
              }`}
            >
              <Icon i={item.icon} size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Avatar name={name} src={user?.avatarUrl} className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground truncate">{name}</div>
            <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
          </div>
          <LogoutButton
            iconOnly
            className="shrink-0 text-foreground opacity-70 transition-opacity duration-150 hover:opacity-100"
          />
        </div>
      </div>
    </div>
  );
}
