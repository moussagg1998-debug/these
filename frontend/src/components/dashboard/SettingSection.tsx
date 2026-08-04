// Banani `SettingSection.jsx` — a collapsible settings section with a list
// of items. Banani's own version is fully static (no on/off toggle visual,
// no real expand/collapse) — this port makes both real, since some items
// here are wired to genuine backend state (see phase-6-encadrant-settings.md
// for which ones, and which stay deliberately inert).
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export type SettingItemType = 'toggle' | 'select' | 'text' | 'button';

export interface SettingItem {
  label: string;
  description?: string;
  type: SettingItemType;
  /** Display value for `select`/`text` items. */
  value?: string;
  /** Button label for `button` items. */
  action?: string;
  /** Current state for `toggle` items. */
  checked?: boolean;
  onToggle?: () => void;
  onAction?: () => void;
  disabled?: boolean;
  disabledTitle?: string;
}

interface SettingSectionProps {
  title: string;
  icon: string;
  items: SettingItem[];
  defaultOpen?: boolean;
}

export function SettingSection({ title, icon, items, defaultOpen = true }: SettingSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-input border-b border-border"
      >
        <div className="flex items-center gap-3">
          <Icon i={icon} size={18} className="text-foreground" />
          <h3 className="text-sm font-semibold font-headings text-foreground">{title}</h3>
        </div>
        <Icon
          i={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          className="text-muted-foreground"
        />
      </button>

      {open && (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 px-5 py-3 flex-wrap sm:flex-nowrap"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                )}
              </div>

              {item.type === 'toggle' && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.checked ?? false}
                  disabled={item.disabled}
                  title={item.disabled ? item.disabledTitle : undefined}
                  onClick={item.onToggle}
                  className={`shrink-0 relative w-10 h-6 rounded-full border transition-colors ${
                    item.disabled
                      ? 'bg-muted border-border opacity-50 cursor-not-allowed'
                      : item.checked
                        ? 'bg-primary border-primary'
                        : 'bg-muted border-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-surface transition-transform ${
                      item.checked ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
              )}

              {item.type === 'select' && (
                <div
                  title={item.disabled ? item.disabledTitle : undefined}
                  className={`shrink-0 flex items-center gap-2 text-xs rounded-sm px-2 py-1 border text-muted-foreground bg-surface border-border ${
                    item.disabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {item.value}
                  <Icon i="chevron-down" size={12} />
                </div>
              )}

              {item.type === 'text' && (
                <div className="shrink-0 text-sm text-foreground font-medium">{item.value}</div>
              )}

              {item.type === 'button' && (
                <button
                  type="button"
                  disabled={item.disabled}
                  title={item.disabled ? item.disabledTitle : undefined}
                  onClick={item.onAction}
                  className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-sm border ${
                    item.disabled
                      ? 'text-muted-foreground border-border opacity-50 cursor-not-allowed'
                      : 'text-primary border-primary'
                  }`}
                >
                  {item.action}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
