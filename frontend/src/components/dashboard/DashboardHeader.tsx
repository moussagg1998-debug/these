// Shared Encadrant page header — replaces the 8 duplicated
// "eyebrow + title" header blocks (dashboard, students, students/[id],
// documents, comments, deadlines, settings, messages). Adds the search bar
// + notification bell present in the Banani DashboardEncadrant.jsx mockup
// but previously missing from every Encadrant page (NotificationBell
// existed already, generic, only ever mounted in StudentNav).
'use client';

import type { ReactNode } from 'react';
import { NotificationBell } from '@/components/student/NotificationBell';
import { Icon } from '@/components/ui/Icon';

interface DashboardHeaderSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface DashboardHeaderProps {
  eyebrow: string;
  title: ReactNode;
  search?: DashboardHeaderSearch;
  actions?: ReactNode;
}

export function DashboardHeader({ eyebrow, title, search, actions }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 bg-surface border-b border-border">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
          {eyebrow}
        </div>
        <h1 className="text-xl font-semibold font-headings text-foreground truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {search && (
          <div className="hidden md:flex items-center gap-2 border border-border rounded-sm px-3 py-2 bg-input text-sm w-56 transition-colors duration-150 focus-within:border-primary">
            <Icon i="search" size={14} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Rechercher…'}
              className="flex-1 min-w-0 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}
        {actions}
        <NotificationBell />
      </div>
    </div>
  );
}
