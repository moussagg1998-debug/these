// "Universités" table — Option A scope. Real name + real encadrant/student
// counts only (GET /api/admin/institutions). No pays/plan/statut columns —
// those fields don't exist on Institution today (see
// .planning/banani/admin-dashboard.md), so they're dropped rather than
// fabricated.
import { Skeleton } from '@/components/ui/Skeleton';

interface InstitutionRow {
  id: string;
  name: string;
  encadrants: number;
  students: number;
}

interface InstitutionsTableProps {
  items: InstitutionRow[];
  loading: boolean;
}

export function InstitutionsTable({ items, loading }: InstitutionsTableProps) {
  return (
    <div className="flex-1 min-w-0 rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface">
        <div className="text-sm font-semibold text-foreground">Universités</div>
      </div>
      {loading ? (
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[2fr_100px_100px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-6" />
              </div>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground motion-safe:animate-fade-in">
          Aucune université pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="grid grid-cols-[2fr_100px_100px] gap-2 px-5 py-2 border-b border-border bg-background">
              {['Institution', 'Encad.', 'Étud.'].map((h) => (
                <div
                  key={h}
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </div>
              ))}
            </div>
            {items.map((inst) => (
              <div
                key={inst.id}
                className="grid grid-cols-[2fr_100px_100px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
              >
                <div className="text-sm font-medium text-foreground truncate pr-2">{inst.name}</div>
                <div className="text-sm font-semibold text-foreground">{inst.encadrants}</div>
                <div className="text-sm font-semibold text-foreground">{inst.students}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
