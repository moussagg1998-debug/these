// Admin — Tableau de bord — Banani `new_screen9.jsx`'s own sidebar.
//
// Option A scope (.planning/banani/admin-dashboard.md): "Tableau de bord",
// "Monitoring" (Admin → Monitoring health center), "Emails" (Admin →
// Monitoring des emails), "Documents" (Admin → Gestion des documents),
// "Alertes" (Admin → Centre d'alertes), "Sécurité" (Admin → Sécurité),
// "Audit Log" (Admin → Journal d'audit), and "Encadrants"/"Étudiants" (both
// point at Admin → Gestion des utilisateurs, pre-filtered by profileType)
// are real links. The remaining 4 items render visibly but inert
// (title="Bientôt disponible"), same established pattern as
// StudentMessagingContent's phone/info buttons and StudentNav's early inert
// links, rather than fabricating 4 unbuilt screens or silently deleting
// them from the design.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { Tooltip } from '@/components/ui/Tooltip';

interface AdminNavItem {
  icon: string;
  label: string;
  href?: string;
}

const NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', icon: 'layout-dashboard', label: 'Tableau de bord' },
  { href: '/admin/monitoring', icon: 'activity', label: 'Monitoring' },
  { href: '/admin/emails', icon: 'mail', label: 'Emails' },
  { href: '/admin/documents', icon: 'file-text', label: 'Documents' },
  { icon: 'building-2', label: 'Universités' },
  { href: '/admin/users?profileType=ENCADRANT', icon: 'user-check', label: 'Encadrants' },
  { href: '/admin/users?profileType=ETUDIANT', icon: 'users', label: 'Étudiants' },
  { href: '/admin/subscriptions', icon: 'credit-card', label: 'Abonnements' },
  { icon: 'bar-chart-2', label: 'Analytiques' },
  { href: '/admin/alerts', icon: 'bell', label: 'Alertes' },
  { href: '/admin/security', icon: 'shield', label: 'Sécurité' },
  { href: '/admin/audit-log', icon: 'file-text', label: 'Audit Log' },
  { icon: 'settings', label: 'Configuration' },
];

interface AdminSidebarProps {
  email: string;
  role: 'ADMIN' | 'SUPERADMIN';
}

export function AdminSidebar({ email, role }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="hidden lg:flex flex-col w-56 shrink-0 bg-surface border-r border-border h-full">
      <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 rounded-md bg-white p-1.5">
            <img src="/logo.jpg" alt="ThèseFacile" className="h-6 w-auto" />
          </div>
          <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Administration
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1">
        {NAV_ITEMS.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-colors duration-150 ${
                pathname === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground opacity-70 hover:opacity-100'
              }`}
            >
              <Icon i={item.icon} size={14} />
              {item.label}
            </Link>
          ) : (
            <Tooltip key={item.label} label="Bientôt disponible" side="right" className="w-full">
              <button
                type="button"
                disabled
                className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium text-muted-foreground opacity-40 cursor-not-allowed text-left"
              >
                <Icon i={item.icon} size={14} />
                {item.label}
              </button>
            </Tooltip>
          ),
        )}
      </nav>

      <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center shrink-0">
            <Icon i="shield" size={14} className="text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground truncate">
              {role === 'SUPERADMIN' ? 'Super Admin' : 'Admin'}
            </div>
            <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {email}
            </div>
          </div>
          <LogoutButton
            iconOnly
            className="shrink-0 text-foreground opacity-60 transition-opacity duration-150 hover:opacity-100"
          />
        </div>
      </div>
    </div>
  );
}

export { NAV_ITEMS as ADMIN_NAV_ITEMS };
