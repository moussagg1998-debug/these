// Banani `FilterBar.jsx` — horizontal stage filter tabs. Banani hardcoded
// the counts; here they're computed from the real list by the caller so the
// numbers never drift from what's actually shown.
'use client';

import { useSlidingIndicator } from '@/lib/useSlidingIndicator';

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
  const { containerRef, registerItem, style, ready } = useSlidingIndicator(active);

  return (
    <div className="pb-4 border-b border-border overflow-x-auto">
      <div ref={containerRef} className="relative flex items-center gap-1 w-fit">
        <div
          aria-hidden
          className={`absolute inset-y-0 rounded-sm bg-primary transition-[left,width] duration-250 ease-out ${ready ? 'opacity-100' : 'opacity-0'}`}
          style={{ left: style.left, width: style.width }}
        />
        {STAGE_FILTERS.map((filter) => (
          <button
            key={filter.id}
            ref={registerItem(filter.id)}
            type="button"
            onClick={() => onChange(filter.id)}
            className={`relative z-10 shrink-0 px-4 py-2 text-sm font-medium rounded-sm border transition duration-150 motion-safe:active:scale-[0.97] ${
              filter.id === active
                ? 'text-primary-foreground border-primary'
                : 'bg-surface border-border text-foreground hover:bg-input'
            }`}
          >
            <span>{filter.label}</span>
            <span
              className={`ml-1.5 text-xs font-semibold ${
                filter.id === active
                  ? 'text-primary-foreground opacity-70'
                  : 'text-muted-foreground'
              }`}
            >
              {counts[filter.id] ?? 0}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
