// Banani student screens (`Dashboard Étudiant`, `Dépôt de fichier étudiant`,
// `Messagerie étudiant-encadrant`) all share this exact top nav — extracted
// here for reuse across Phases 7-9. "Mon mémoire" is the only real
// destination (→ /dashboard); Banani's own source renders "Documents" /
// "Commentaires" / "Calendrier" as plain `<a>` with no href/onClick in every
// screen that has this nav, and no dedicated student-side routes for those
// exist in the committed scope — kept as inert text rather than fake links.
// The notification bell is wired to the real (pre-existing, previously
// unused anywhere) GET /api/notifications/count.
'use client';

import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';

interface NotificationCountResponse {
  count: number;
}

interface StudentNavProps {
  name: string;
  active?: 'dashboard';
}

export function StudentNav({ name, active }: StudentNavProps) {
  const { data } = useApi<NotificationCountResponse>('/api/notifications/count');
  const count = data?.count ?? 0;

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
        <span
          className="text-muted-foreground opacity-50 cursor-not-allowed"
          title="Bientôt disponible"
        >
          Documents
        </span>
        <span
          className="text-muted-foreground opacity-50 cursor-not-allowed"
          title="Bientôt disponible"
        >
          Commentaires
        </span>
        <span
          className="text-muted-foreground opacity-50 cursor-not-allowed"
          title="Bientôt disponible"
        >
          Calendrier
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 rounded-sm border border-border bg-surface flex items-center justify-center">
            <Icon i="bell" size={15} />
          </div>
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border">
          <Avatar name={name} className="h-8 w-8" />
          <div className="text-xs font-semibold text-foreground">{name}</div>
        </div>
      </div>
    </nav>
  );
}
