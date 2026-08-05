// Shared chrome for every Encadrant back-office page (/dashboard, /students,
// /students/[id]) — the persistent `Sidebar` collapses below `lg:` (a fixed
// 224px column doesn't fit a 375px viewport), replaced by a mobile top bar
// whose hamburger opens the same nav links in a slide-in drawer. Extracted
// once three pages needed identical chrome (Dashboard, Students List,
// Student Detail) — same rule-of-three as MarketingNav/Footer in Phase 2.
'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Sidebar, NAV_ITEMS } from '@/components/dashboard/Sidebar';
import { isNavItemActive } from '@/lib/nav-active';

interface DashboardShellProps {
  name: string;
  subtitle?: string | undefined;
  header?: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ name, subtitle, header, children }: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-dvh overflow-hidden bg-background font-body">
      <Sidebar name={name} subtitle={subtitle} />

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 bg-primary flex flex-col">
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'rgba(245,243,238,0.15)' }}
            >
              <span className="font-headings font-semibold text-primary-foreground">
                ThèseFacile
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
              >
                <Icon i="x" size={18} className="text-primary-foreground" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-3 py-4">
              {NAV_ITEMS.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? 'bg-primary-foreground text-primary'
                        : 'text-primary-foreground opacity-70'
                    }`}
                  >
                    <Icon i={item.icon} size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            type="button"
            className="flex-1 bg-black/40"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex lg:hidden items-center justify-between px-4 py-3 bg-primary shrink-0">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Ouvrir le menu">
            <Icon i="sliders" size={18} className="text-primary-foreground" />
          </button>
          <span className="font-headings font-semibold text-sm text-primary-foreground">
            ThèseFacile
          </span>
          <div className="w-[18px]" />
        </div>
        {header && <div className="shrink-0">{header}</div>}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
