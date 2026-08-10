// Admin chrome — mirrors DashboardShell's mobile drawer pattern (a fixed
// 224px sidebar doesn't fit a 375px viewport), themed dark to match the
// Banani admin mockup's own sidebar instead of the Encadrant green.
'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { AdminSidebar, ADMIN_NAV_ITEMS } from './AdminSidebar';

interface AdminShellProps {
  email: string;
  role: 'ADMIN' | 'SUPERADMIN';
  header?: ReactNode;
  children: ReactNode;
}

export function AdminShell({ email, role, header, children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-background font-body">
      <AdminSidebar email={email} role={role} />

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 bg-surface flex flex-col motion-safe:animate-slide-in-left">
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <span className="font-headings font-semibold text-foreground">Administration</span>
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
              {ADMIN_NAV_ITEMS.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground"
                  >
                    <Icon i={item.icon} size={16} />
                    {item.label}
                  </Link>
                ) : (
                  <Tooltip
                    key={item.label}
                    label="Bientôt disponible"
                    side="right"
                    className="w-full"
                  >
                    <button
                      type="button"
                      disabled
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-foreground opacity-40 cursor-not-allowed text-left"
                    >
                      <Icon i={item.icon} size={16} />
                      {item.label}
                    </button>
                  </Tooltip>
                ),
              )}
            </nav>
            <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex lg:hidden items-center justify-between px-4 py-3 bg-surface border-b border-border shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="transition duration-150 motion-safe:active:scale-90"
          >
            <Icon i="sliders" size={18} className="text-foreground" />
          </button>
          <span className="font-headings font-semibold text-sm text-foreground">
            Administration
          </span>
          <div className="w-[18px]" />
        </div>
        {header && <div className="shrink-0">{header}</div>}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
