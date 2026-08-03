// Banani `FilterBar.jsx` — horizontal stage filter tabs. Banani hardcoded
// the counts; here they're computed from the real list by the caller so the
// numbers never drift from what's actually shown.
export type StageFilterId = 'all' | 'writing' | 'revision' | 'defense' | 'waiting' | 'blocked';

export const STAGE_FILTERS: { id: StageFilterId; label: string; stage: string | null }[] = [
  { id: 'all', label: 'Tous', stage: null },
  { id: 'writing', label: 'Rédaction', stage: 'Rédaction' },
  { id: 'revision', label: 'Révision', stage: 'Révision' },
  { id: 'defense', label: 'Soutenance', stage: 'Soutenance' },
  { id: 'waiting', label: 'En attente', stage: 'En attente' },
  { id: 'blocked', label: 'Bloqué', stage: 'Bloqué' },
];

interface FilterBarProps {
  active: StageFilterId;
  onChange: (id: StageFilterId) => void;
  counts: Record<StageFilterId, number>;
}

export function FilterBar({ active, onChange, counts }: FilterBarProps) {
  return (
    <div className="flex items-center gap-1 pb-4 border-b border-border overflow-x-auto">
      {STAGE_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => onChange(filter.id)}
          className={`shrink-0 px-4 py-2 text-sm font-medium rounded-sm border ${
            filter.id === active
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-surface border-border text-foreground'
          }`}
        >
          <span>{filter.label}</span>
          <span
            className={`ml-1.5 text-xs font-semibold ${
              filter.id === active ? 'text-primary-foreground opacity-70' : 'text-muted-foreground'
            }`}
          >
            {counts[filter.id] ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}
