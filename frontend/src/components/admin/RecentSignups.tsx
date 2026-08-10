// "Nouveaux inscrits" — real recent signups from GET /api/admin/users
// (already ordered createdAt desc), extended with profileType + institution
// name for the role label / université shown here.
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { relativeTime } from '@/lib/theses';

interface RecentUser {
  id: string;
  name: string | null;
  email: string;
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  institution: { name: string } | null;
  createdAt: string;
}

interface RecentSignupsProps {
  items: RecentUser[];
  loading: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  ENCADRANT: 'Encadrant',
  ETUDIANT: 'Étudiant',
};

export function RecentSignups({ items, loading }: RecentSignupsProps) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border bg-surface">
        <div className="text-sm font-semibold text-foreground">Nouveaux inscrits</div>
      </div>
      {loading ? (
        <div className="divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 py-4 text-xs text-muted-foreground motion-safe:animate-fade-in">
          Aucune inscription récente.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((u) => {
            const displayName = u.name || u.email.split('@')[0] || u.email;
            const roleLabel = u.profileType ? ROLE_LABEL[u.profileType] : null;
            return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={displayName} className="h-7 w-7 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {displayName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.institution?.name ?? '—'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {roleLabel && (
                    <div
                      className={`text-xs font-medium px-1.5 py-0.5 rounded-sm mb-0.5 ${
                        roleLabel === 'Encadrant'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {roleLabel}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{relativeTime(u.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
