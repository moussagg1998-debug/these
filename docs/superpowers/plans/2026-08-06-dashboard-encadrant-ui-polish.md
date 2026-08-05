# Dashboard Encadrant UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Encadrant back-office to full fidelity with the Banani `DashboardEncadrant.jsx` mockup, remove the "Année 2024–2025" mention app-wide, harden the sidebar's active-link logic, and add CSS-only hover/entrance animations plus a real responsive audit across the whole app (Encadrant, Étudiant, public pages).

**Architecture:** No new dependencies, no new API routes, no schema changes. A new pure helper (`isNavItemActive`) de-duplicates and unit-tests the nav highlight logic. A new shared `DashboardHeader` component replaces 8 copies of duplicated header markup and adds the missing search bar + notification bell (reusing the already-generic `NotificationBell`). Animations are plain Tailwind utility classes plus a handful of `@theme`-registered keyframes in `globals.css` — Tailwind v4's `--animate-*` theme tokens auto-generate `animate-*` utilities, combined with the built-in `motion-safe:`/`motion-reduce:` variants for `prefers-reduced-motion`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (`@theme`, no config file), TypeScript strict, Vitest.

## Global Constraints

- No new npm dependencies (no Framer Motion or equivalent) — CSS/Tailwind only.
- `NotificationBell.tsx` stays at `frontend/src/components/student/NotificationBell.tsx` — import it from there in Encadrant code, do not move the file.
- The "Envoyer des rappels groupés" button stays decorative (`disabled`, `title="Bientôt disponible"`) — no backend for group reminders exists and building one is out of scope.
- No new API routes. The dashboard/students search is 100% client-side filtering of already-fetched data.
- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` — no `any` casts.
- This codebase has **zero component tests by convention** (confirmed: no `.test.tsx` file exists anywhere in `frontend/src/components` or `frontend/src/app`). Only pure/logic modules get Vitest unit tests. UI tasks are verified via `pnpm typecheck`, `pnpm lint`, `pnpm build`, and manual/Playwright browser checks — do not invent new `.test.tsx` files.
- Run `pnpm format` before every commit (Prettier is wired into the pre-commit hook and will reformat on commit anyway, but running it first avoids surprise diffs).
- Every command in this plan is run from the repo root (`c:/Users/HP/Facile`) unless stated otherwise.

---

## Task 1: Extract and unit-test `isNavItemActive`

The exact same expression `pathname === item.href || pathname?.startsWith(\`${item.href}/\`)` is duplicated verbatim in `Sidebar.tsx` (desktop nav) and `DashboardShell.tsx` (mobile drawer nav) — a real DRY violation regardless of the reported highlight bug. Static review of both call sites found no logic defect (no `trailingSlash` config, no `basePath`, standard `usePathname()` usage), so this task's job is to make the logic a single, independently tested source of truth. If the reported "Mes étudiants stays highlighted" bug is still reproducible after this change, Task 20's manual QA pass will catch it and it gets root-caused live with actual dev-server reproduction (there is no way to pre-diagnose a bug that doesn't reproduce from static code review).

**Files:**
- Create: `frontend/src/lib/nav-active.ts`
- Create: `frontend/src/lib/nav-active.test.ts`
- Modify: `frontend/src/components/dashboard/Sidebar.tsx:1-10,46`
- Modify: `frontend/src/components/dashboard/DashboardShell.tsx:1-13,50`

**Interfaces:**
- Produces: `isNavItemActive(pathname: string | null, href: string): boolean` — imported by both nav components in this task, and available for any future nav (e.g. `StudentNav.tsx`, out of scope here since it already uses hardcoded `active` props, not pathname matching).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/nav-active.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isNavItemActive } from './nav-active';

describe('isNavItemActive', () => {
  it('matches an exact pathname', () => {
    expect(isNavItemActive('/students', '/students')).toBe(true);
  });

  it('matches a nested pathname under the href', () => {
    expect(isNavItemActive('/students/abc123', '/students')).toBe(true);
  });

  it('does not match a sibling route', () => {
    expect(isNavItemActive('/documents', '/students')).toBe(false);
  });

  it('does not match a route that merely shares a text prefix without a slash boundary', () => {
    expect(isNavItemActive('/students-archive', '/students')).toBe(false);
  });

  it('does not treat a nested route as matching an unrelated root item', () => {
    expect(isNavItemActive('/students', '/dashboard')).toBe(false);
  });

  it('returns false for a null pathname', () => {
    expect(isNavItemActive(null, '/dashboard')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run src/lib/nav-active.test.ts`
Expected: FAIL — `Cannot find module './nav-active'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/nav-active.ts`:

```ts
// Single source of truth for "is this sidebar/nav link the current page" —
// previously duplicated verbatim in Sidebar.tsx and DashboardShell.tsx.
export function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/lib/nav-active.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Wire it into `Sidebar.tsx`**

In `frontend/src/components/dashboard/Sidebar.tsx`, modify the import block:

```ts
// Old:
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';

// New:
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { isNavItemActive } from '@/lib/nav-active';
```

And the highlight line:

```ts
// Old:
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

// New:
          const isActive = isNavItemActive(pathname, item.href);
```

- [ ] **Step 6: Wire it into `DashboardShell.tsx`**

In `frontend/src/components/dashboard/DashboardShell.tsx`, modify the import block:

```ts
// Old:
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Sidebar, NAV_ITEMS } from '@/components/dashboard/Sidebar';

// New:
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Sidebar, NAV_ITEMS } from '@/components/dashboard/Sidebar';
import { isNavItemActive } from '@/lib/nav-active';
```

And the highlight line:

```ts
// Old:
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

// New:
                const isActive = isNavItemActive(pathname, item.href);
```

- [ ] **Step 7: Typecheck and full test suite**

Run: `pnpm typecheck && pnpm --filter frontend exec vitest run`
Expected: both green, no regressions.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/nav-active.ts frontend/src/lib/nav-active.test.ts frontend/src/components/dashboard/Sidebar.tsx frontend/src/components/dashboard/DashboardShell.tsx
git commit -m "refactor(nav): extract and unit-test isNavItemActive, dedupe Sidebar/DashboardShell"
```

---

## Task 2: `DashboardHeader` shared component

Replaces the 8 verbatim-duplicated header blocks (`"Encadrement · Année 2024–2025"` + title, or the equivalent "Compte"/"Communication" eyebrow variants on `/settings`/`/messages`) across the Encadrant pages, adds the missing search bar and notification bell (Banani has both; today's Encadrant headers have neither — `NotificationBell` already exists and is fully generic, just never mounted outside `StudentNav`).

**Files:**
- Create: `frontend/src/components/dashboard/DashboardHeader.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface DashboardHeaderProps {
    eyebrow: string;
    title: ReactNode;
    search?: { value: string; onChange: (value: string) => void; placeholder?: string };
    actions?: ReactNode;
  }
  function DashboardHeader(props: DashboardHeaderProps): JSX.Element
  ```
  Consumed by Tasks 4–11 (all 8 Encadrant page headers: dashboard, students, students/[id], documents, comments, deadlines, settings, messages).
- Consumes: `NotificationBell` from `@/components/student/NotificationBell` (no props), `Icon` from `@/components/ui/Icon`.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/DashboardHeader.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (the component isn't wired into any page yet, so this only checks the file compiles standalone).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/DashboardHeader.tsx
git commit -m "feat(dashboard): add shared DashboardHeader with search + notification bell"
```

---

## Task 3: Animation foundation in `globals.css`

Registers 4 keyframes as Tailwind v4 `@theme` animation tokens (auto-generates `animate-fade-in`, `animate-scale-in`, `animate-slide-up`, `animate-slide-in-left` utilities). No new dependency — Tailwind v4's `--animate-*` namespace is core functionality. Consumers use these with the built-in `motion-safe:`/`motion-reduce:` variants so `prefers-reduced-motion: reduce` disables them automatically.

**Files:**
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces Tailwind utility classes: `animate-fade-in`, `animate-scale-in`, `animate-slide-up`, `animate-slide-in-left` — consumed by Task 14 (modal fade/scale) and Task 15 (drawer slide-in, backdrop fade, dropdown slide-up). Tasks 13, 16, and 17 use only built-in Tailwind hover/active/transform utilities, not these custom keyframes.

- [ ] **Step 1: Add the animation tokens and keyframes**

In `frontend/src/app/globals.css`, insert new `--animate-*` tokens inside the existing `@theme` block (right after the `--text-4xl` line) and the `@keyframes` rules after the `@theme` block closes:

```css
// Old (end of @theme block):
  --text-4xl: 42px;
}

// New:
  --text-4xl: 42px;

  --animate-fade-in: fade-in 150ms ease-out;
  --animate-scale-in: scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
  --animate-slide-up: slide-up 180ms cubic-bezier(0.16, 1, 0.3, 1);
  --animate-slide-in-left: slide-in-left 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-in-left {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
```

- [ ] **Step 2: Verify the build picks up the new utilities**

Run: `pnpm --filter frontend exec next build --no-lint 2>&1 | tail -30`
Expected: build succeeds (Tailwind v4 compiles `@theme` at build time — a syntax error in the CSS would fail the build here). This is slower than typecheck; if impatient, `pnpm dev` and inspect the compiled CSS in devtools for `.animate-fade-in` also confirms it, but the build is the authoritative check.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(css): register fade-in/scale-in/slide-up/slide-in-left animation tokens"
```

---

## Task 4: Wire `DashboardHeader` into `/dashboard` + stage filter + search + decorative "rappels" button

Closes the remaining Banani-fidelity gaps on the dashboard itself: search, stage filter above the table, and the decorative "Envoyer des rappels groupés" button pinned to the bottom of the activity panel. Also removes "Année 2024–2025".

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Update imports**

```ts
// Old:
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { StudentRow } from '@/components/dashboard/StudentRow';
import { ActivityItem } from '@/components/dashboard/ActivityItem';
import { AddStudentForm } from '@/components/dashboard/AddStudentForm';
import { StudentDashboardContent } from '@/components/student/StudentDashboardContent';
import {
  displayName,
  formatDate,
  relativeTime,
  urgencyFromDueDate,
  type ThesisListItem,
} from '@/lib/theses';

// New:
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { StudentRow } from '@/components/dashboard/StudentRow';
import { ActivityItem } from '@/components/dashboard/ActivityItem';
import { AddStudentForm } from '@/components/dashboard/AddStudentForm';
import { FilterBar, STAGE_FILTERS, type StageFilterId } from '@/components/dashboard/FilterBar';
import { StudentDashboardContent } from '@/components/student/StudentDashboardContent';
import {
  displayName,
  formatDate,
  relativeTime,
  urgencyFromDueDate,
  type ThesisListItem,
} from '@/lib/theses';
```

- [ ] **Step 2: Add search + filter state and derived lists**

```ts
// Old:
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

// New:
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<StageFilterId>('all');
```

Add the `counts` and `visibleItems` derivations right after the existing `items` memo (`const items = useMemo(() => theses?.items ?? [], [theses]);`):

```ts
  const counts = useMemo(() => {
    const result: Record<StageFilterId, number> = {
      all: items.length,
      writing: 0,
      revision: 0,
      defense: 0,
      waiting: 0,
      blocked: 0,
    };
    for (const filter of STAGE_FILTERS) {
      if (filter.stage) result[filter.id] = items.filter((t) => t.stage === filter.stage).length;
    }
    return result;
  }, [items]);

  const visibleItems = useMemo(() => {
    const filterDef = STAGE_FILTERS.find((f) => f.id === activeFilter);
    const byStage = filterDef?.stage ? items.filter((t) => t.stage === filterDef.stage) : items;
    const q = search.trim().toLowerCase();
    if (!q) return byStage;
    return byStage.filter(
      (t) =>
        displayName(t.student).toLowerCase().includes(q) ||
        t.student.email.toLowerCase().includes(q) ||
        t.topic.toLowerCase().includes(q),
    );
  }, [items, activeFilter, search]);
```

- [ ] **Step 3: Replace the header block**

```tsx
// Old:
    <DashboardShell
      name={name}
      header={
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Encadrement · Année 2024–2025
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">Bonjour, {name}</h1>
          </div>
        </div>
      }
    >

// New:
    <DashboardShell
      name={name}
      header={
        <DashboardHeader
          eyebrow="Encadrement"
          title={`Bonjour, ${name}`}
          search={{ value: search, onChange: setSearch, placeholder: 'Rechercher un étudiant…' }}
        />
      }
    >
```

- [ ] **Step 4: Add the stage filter above the table and switch to `visibleItems`**

```tsx
// Old:
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold font-headings text-foreground">
                Mes thèses & mémoires
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/students"
                  className="text-xs font-medium text-muted-foreground border border-border rounded-sm px-3 py-1.5"
                >
                  Voir tout
                </Link>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="text-xs font-medium text-primary border border-primary px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                >
                  <Icon i="plus" size={12} />
                  Ajouter un étudiant
                </button>
              </div>
            </div>

            {thesesLoading && !theses ? (

// New:
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold font-headings text-foreground">
                Mes thèses & mémoires
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/students"
                  className="text-xs font-medium text-muted-foreground border border-border rounded-sm px-3 py-1.5"
                >
                  Voir tout
                </Link>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="text-xs font-medium text-primary border border-primary px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                >
                  <Icon i="plus" size={12} />
                  Ajouter un étudiant
                </button>
              </div>
            </div>

            <div className="mb-3">
              <FilterBar active={activeFilter} onChange={setActiveFilter} counts={counts} />
            </div>

            {thesesLoading && !theses ? (
```

Then further down, swap the empty-state check and the `.slice(0, 7).map(...)` from `items` to `visibleItems`:

```tsx
// Old:
            ) : items.length === 0 ? (
              <div className="border border-dashed border-border rounded-md p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun étudiant pour l&apos;instant — ajoutez-en un pour commencer le suivi.
                </p>
              </div>
            ) : (

// New:
            ) : visibleItems.length === 0 ? (
              <div className="border border-dashed border-border rounded-md p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {items.length === 0
                    ? "Aucun étudiant pour l'instant — ajoutez-en un pour commencer le suivi."
                    : 'Aucun résultat pour ce filtre ou cette recherche.'}
                </p>
              </div>
            ) : (
```

```tsx
// Old:
                <div className="min-w-max">
                  {items.slice(0, 7).map((thesis) => (
                    <StudentRow key={thesis.id} thesis={thesis} />
                  ))}
                </div>

// New:
                <div className="min-w-max">
                  {visibleItems.slice(0, 7).map((thesis) => (
                    <StudentRow key={thesis.id} thesis={thesis} />
                  ))}
                </div>
```

- [ ] **Step 5: Add the decorative "Envoyer des rappels groupés" button**

```tsx
// Old (end of the right sidebar panel, just before the closing tags):
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (

// New:
            </div>
          </div>

          <button
            type="button"
            disabled
            title="Bientôt disponible"
            className="mt-auto w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-sm opacity-50 cursor-not-allowed"
          >
            <Icon i="send" size={14} />
            Envoyer des rappels groupés
          </button>
        </div>
      </div>

      {modalOpen && (
```

(This closes the `gap-5` sidebar `<div>` — the button becomes its last child, `mt-auto` pins it to the bottom on `xl:` where the panel stretches full-height next to the table column.)

- [ ] **Step 6: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

Run `pnpm dev`, sign in as an Encadrant, open `/dashboard`. Confirm: no "Année 2024–2025" text anywhere in the header; typing in the search box filters the table by student name/email/topic; the stage filter row appears above the table and filters correctly; the "Envoyer des rappels groupés" button renders at the bottom of the right panel, disabled, with a "Bientôt disponible" tooltip on hover; the notification bell renders top-right and opens the existing dropdown.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat(dashboard): DashboardHeader with search, stage filter, decorative rappels button"
```

---

## Task 5: Wire `DashboardHeader` into `/students`

**Files:**
- Modify: `frontend/src/app/students/page.tsx`

- [ ] **Step 1: Update imports**

```ts
// Old:
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StudentRow } from '@/components/dashboard/StudentRow';
import { FilterBar, STAGE_FILTERS, type StageFilterId } from '@/components/dashboard/FilterBar';
import { AddStudentForm } from '@/components/dashboard/AddStudentForm';
import type { ThesisListItem } from '@/lib/theses';

// New:
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StudentRow } from '@/components/dashboard/StudentRow';
import { FilterBar, STAGE_FILTERS, type StageFilterId } from '@/components/dashboard/FilterBar';
import { AddStudentForm } from '@/components/dashboard/AddStudentForm';
import { displayName, type ThesisListItem } from '@/lib/theses';
```

- [ ] **Step 2: Add search state and fold it into `filtered`**

```ts
// Old:
  const [modalOpen, setModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StageFilterId>('all');
  const [extraItems, setExtraItems] = useState<ThesisListItem[]>([]);

// New:
  const [modalOpen, setModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StageFilterId>('all');
  const [search, setSearch] = useState('');
  const [extraItems, setExtraItems] = useState<ThesisListItem[]>([]);
```

```ts
// Old:
  const filtered = useMemo(() => {
    const filter = STAGE_FILTERS.find((f) => f.id === activeFilter);
    if (!filter?.stage) return items;
    return items.filter((t) => t.stage === filter.stage);
  }, [items, activeFilter]);

// New:
  const filtered = useMemo(() => {
    const filter = STAGE_FILTERS.find((f) => f.id === activeFilter);
    const byStage = filter?.stage ? items.filter((t) => t.stage === filter.stage) : items;
    const q = search.trim().toLowerCase();
    if (!q) return byStage;
    return byStage.filter(
      (t) =>
        displayName(t.student).toLowerCase().includes(q) ||
        t.student.email.toLowerCase().includes(q) ||
        t.topic.toLowerCase().includes(q),
    );
  }, [items, activeFilter, search]);
```

- [ ] **Step 3: Replace the header block**

```tsx
// Old:
    <DashboardShell
      name={name}
      header={
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Encadrement · Année 2024–2025
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">Mes étudiants</h1>
          </div>
        </div>
      }
    >

// New:
    <DashboardShell
      name={name}
      header={
        <DashboardHeader
          eyebrow="Encadrement"
          title="Mes étudiants"
          search={{ value: search, onChange: setSearch, placeholder: 'Rechercher un étudiant…' }}
        />
      }
    >
```

- [ ] **Step 4: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, visit `/students`, confirm the header no longer shows "Année 2024–2025", the search box filters the list (combined correctly with the existing stage filter tabs), and the bell renders.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/students/page.tsx
git commit -m "feat(students): DashboardHeader with search, remove Année mention"
```

---

## Task 6: Wire `DashboardHeader` into `/students/[id]`

Uses the `title: ReactNode` slot to keep the existing breadcrumb ("Mes étudiants › {studentName}").

**Files:**
- Modify: `frontend/src/app/students/[id]/page.tsx`

- [ ] **Step 1: Update imports**

```ts
// Old:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StudentProfileSidebar } from '@/components/dashboard/StudentProfileSidebar';

// New:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StudentProfileSidebar } from '@/components/dashboard/StudentProfileSidebar';
```

- [ ] **Step 2: Replace the header block**

```tsx
// Old:
    <DashboardShell
      name={name}
      header={
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Encadrement · Année 2024–2025
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/students"
                className="text-lg font-semibold font-headings text-primary underline"
              >
                Mes étudiants
              </Link>
              <Icon i="chevron-right" size={16} className="text-muted-foreground" />
              <h1 className="text-lg font-semibold font-headings text-foreground">{studentName}</h1>
            </div>
          </div>
        </div>
      }
    >

// New:
    <DashboardShell
      name={name}
      header={
        <DashboardHeader
          eyebrow="Encadrement"
          title={
            <span className="flex items-center gap-3">
              <Link href="/students" className="text-primary underline">
                Mes étudiants
              </Link>
              <Icon i="chevron-right" size={16} className="text-muted-foreground shrink-0" />
              <span className="truncate">{studentName}</span>
            </span>
          }
        />
      }
    >
```

- [ ] **Step 3: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, open a student detail page from `/students`, confirm the breadcrumb still works (click "Mes étudiants" navigates back), no "Année 2024–2025" text, bell renders.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/students/[id]/page.tsx"
git commit -m "feat(students): DashboardHeader breadcrumb title, remove Année mention"
```

---

## Task 7: Wire `DashboardHeader` into `/documents`

**Files:**
- Modify: `frontend/src/app/documents/page.tsx`

- [ ] **Step 1: Update imports**

```ts
// Old:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DocumentRow } from '@/components/dashboard/DocumentRow';

// New:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DocumentRow } from '@/components/dashboard/DocumentRow';
```

- [ ] **Step 2: Replace the header block**

```tsx
// Old:
    <DashboardShell
      name={name}
      header={
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Encadrement · Année 2024–2025
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">
              Bibliothèque de documents
            </h1>
          </div>
        </div>
      }
    >

// New:
    <DashboardShell
      name={name}
      header={<DashboardHeader eyebrow="Encadrement" title="Bibliothèque de documents" />}
    >
```

- [ ] **Step 3: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, visit `/documents`, confirm no "Année 2024–2025" text and the bell renders.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/documents/page.tsx
git commit -m "feat(documents): DashboardHeader, remove Année mention"
```

---

## Task 8: Wire `DashboardHeader` into `/comments`

**Files:**
- Modify: `frontend/src/app/comments/page.tsx`

- [ ] **Step 1: Update imports**

```ts
// Old:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CommentThread } from '@/components/dashboard/CommentThread';

// New:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { CommentThread } from '@/components/dashboard/CommentThread';
```

- [ ] **Step 2: Replace the header block**

```tsx
// Old:
    <DashboardShell
      name={name}
      header={
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Encadrement · Année 2024–2025
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">
              Commentaires &amp; Retours
            </h1>
          </div>
        </div>
      }
    >

// New:
    <DashboardShell
      name={name}
      header={<DashboardHeader eyebrow="Encadrement" title="Commentaires & Retours" />}
    >
```

- [ ] **Step 3: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, visit `/comments`, confirm no "Année 2024–2025" text and the bell renders.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/comments/page.tsx
git commit -m "feat(comments): DashboardHeader, remove Année mention"
```

---

## Task 9: Wire `DashboardHeader` into `/deadlines`

**Files:**
- Modify: `frontend/src/app/deadlines/page.tsx`

- [ ] **Step 1: Update imports**

```ts
// Old:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DeadlineCard } from '@/components/dashboard/DeadlineCard';

// New:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DeadlineCard } from '@/components/dashboard/DeadlineCard';
```

- [ ] **Step 2: Replace the header block**

```tsx
// Old:
    <DashboardShell
      name={name}
      header={
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Encadrement · Année 2024–2025
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">
              Échéances &amp; Jalons
            </h1>
          </div>
        </div>
      }
    >

// New:
    <DashboardShell
      name={name}
      header={<DashboardHeader eyebrow="Encadrement" title="Échéances & Jalons" />}
    >
```

- [ ] **Step 3: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, visit `/deadlines`, confirm no "Année 2024–2025" text and the bell renders.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/deadlines/page.tsx
git commit -m "feat(deadlines): DashboardHeader, remove Année mention"
```

---

## Task 10: Wire `DashboardHeader` into `/settings`

`/settings` never had the "Année" text (its eyebrow is "Compte", not "Encadrement"), so this task is pure consistency + adding the notification bell, not a text removal.

**Files:**
- Modify: `frontend/src/app/settings/page.tsx`

- [ ] **Step 1: Update imports**

```ts
// Old:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { SettingSection, type SettingItem } from '@/components/dashboard/SettingSection';

// New:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { SettingSection, type SettingItem } from '@/components/dashboard/SettingSection';
```

- [ ] **Step 2: Replace the header block**

```tsx
// Old:
      header={
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Compte
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">
              Paramètres &amp; Préférences
            </h1>
          </div>
        </div>
      }
    >

// New:
      header={<DashboardHeader eyebrow="Compte" title="Paramètres & Préférences" />}
    >
```

- [ ] **Step 3: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, visit `/settings` (both "Profil" and "Paramètres" tabs), confirm the header renders identically apart from the new bell, and every existing setting/toggle/modal still works.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/settings/page.tsx
git commit -m "feat(settings): DashboardHeader with notification bell"
```

---

## Task 11: Wire `DashboardHeader` into `/messages` (Encadrant branch)

Same as Task 10 — `/messages` (ENCADRANT branch, `EncadrantMessagingContent.tsx`) never had the "Année" text either (eyebrow "Communication"), this is the bell + consistency pass.

**Files:**
- Modify: `frontend/src/components/dashboard/EncadrantMessagingContent.tsx`

- [ ] **Step 1: Update imports**

```ts
// Old:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AddToCalendarModal } from '@/components/student/AddToCalendarModal';

// New:
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { AddToCalendarModal } from '@/components/student/AddToCalendarModal';
```

- [ ] **Step 2: Replace the header block**

```tsx
// Old:
      header={
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Communication
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">Messages</h1>
          </div>
        </div>
      }
    >

// New:
      header={<DashboardHeader eyebrow="Communication" title="Messages" />}
    >
```

- [ ] **Step 3: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, visit `/messages` as an Encadrant, confirm the header renders identically apart from the new bell, and the 2-pane conversation UI still works (select a thesis, send a message, "Planifier une réunion" still opens `AddToCalendarModal`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/EncadrantMessagingContent.tsx
git commit -m "feat(messages): DashboardHeader with notification bell (Encadrant branch)"
```

---

## Task 12: Remove the remaining "Année 2024–2025" mentions (Étudiant dashboard + marketing homepage)

**Files:**
- Modify: `frontend/src/components/student/StudentDashboardContent.tsx:126-141`
- Modify: `frontend/src/app/page.tsx:113-117,168-176`

- [ ] **Step 1: Remove it from the student dashboard's header card**

```tsx
// Old:
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className={`text-xs px-2 py-1 rounded-sm font-medium ${stageClass}`}>
                  {thesis.stage}
                </div>
                <div className="text-xs text-muted-foreground">Année 2024–2025</div>
              </div>

// New:
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className={`text-xs px-2 py-1 rounded-sm font-medium ${stageClass}`}>
                  {thesis.stage}
                </div>
              </div>
```

- [ ] **Step 2: Remove it from the marketing homepage's stat row data**

```ts
// Old:
const STAT_ROWS = [
  { label: 'Étudiants', value: '12', sub: 'Année 2024-2025' },
  { label: 'En attente', value: '7', sub: '4 urgents' },
  { label: 'Retards', value: '2', sub: 'Kouakou · Fall' },
];

// New:
const STAT_ROWS = [
  { label: 'Étudiants', value: '12', sub: '' },
  { label: 'En attente', value: '7', sub: '4 urgents' },
  { label: 'Retards', value: '2', sub: 'Kouakou · Fall' },
];
```

- [ ] **Step 3: Remove it from the marketing homepage's hero mock-dashboard header**

```tsx
// Old:
            <span className="font-headings text-xs font-semibold text-foreground">ThèseFacile</span>
            <span className="ml-auto text-xs text-muted-foreground">Année 2024–2025</span>
          </div>

// New:
            <span className="font-headings text-xs font-semibold text-foreground">ThèseFacile</span>
          </div>
```

- [ ] **Step 4: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, visit `/` (logged out) and `/dashboard` as an Étudiant account, confirm no "Année" text anywhere.

- [ ] **Step 5: Verify no occurrences remain anywhere**

Run: `grep -rn "Année 2024" frontend/src`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/student/StudentDashboardContent.tsx frontend/src/app/page.tsx
git commit -m "fix(ui): remove remaining Année 2024-2025 mentions (student dashboard, homepage)"
```

---

## Task 13: Animations — Encadrant shared components

Applies the hover/transition recipe to the 6 shared list/card components used across every Encadrant page: subtle lift + shadow on hoverable cards, a background tint on hoverable rows, all guarded by `motion-safe:` so `prefers-reduced-motion: reduce` disables the transform/shadow (color transitions stay, they're not motion).

**Files:**
- Modify: `frontend/src/components/dashboard/StatCard.tsx`
- Modify: `frontend/src/components/dashboard/StudentRow.tsx`
- Modify: `frontend/src/components/dashboard/DeadlineCard.tsx`
- Modify: `frontend/src/components/dashboard/DocumentRow.tsx`
- Modify: `frontend/src/components/dashboard/ActivityItem.tsx`
- Modify: `frontend/src/components/dashboard/CommentThread.tsx`

- [ ] **Step 1: `StatCard.tsx`**

```tsx
// Old:
      className={`flex flex-col gap-3 px-5 py-4 rounded-md border ${
        highlight
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-surface text-foreground border-border'
      }`}

// New:
      className={`flex flex-col gap-3 px-5 py-4 rounded-md border transition-shadow transition-transform duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md ${
        highlight
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-surface text-foreground border-border'
      }`}
```

- [ ] **Step 2: `StudentRow.tsx`**

```tsx
// Old:
    <div className="flex flex-col gap-3 px-5 py-4 border-b border-border bg-surface lg:flex-row lg:items-center lg:gap-4">

// New:
    <div className="flex flex-col gap-3 px-5 py-4 border-b border-border bg-surface transition-colors duration-150 hover:bg-input/40 lg:flex-row lg:items-center lg:gap-4">
```

```tsx
// Old:
        <Link
          href={`/students/${thesis.id}`}
          className="block whitespace-nowrap text-xs font-medium text-primary border border-primary px-3 py-1.5 rounded-sm"
        >
          Ouvrir
        </Link>

// New:
        <Link
          href={`/students/${thesis.id}`}
          className="block whitespace-nowrap text-xs font-medium text-primary border border-primary px-3 py-1.5 rounded-sm transition-colors duration-150 hover:bg-primary hover:text-primary-foreground"
        >
          Ouvrir
        </Link>
```

- [ ] **Step 3: `DeadlineCard.tsx`**

```tsx
// Old:
    <div className={`flex items-start gap-4 p-4 border rounded-md ${URGENCY_CLASS[bucket]}`}>

// New:
    <div
      className={`flex items-start gap-4 p-4 border rounded-md transition-shadow duration-150 motion-safe:hover:shadow-md ${URGENCY_CLASS[bucket]}`}
    >
```

- [ ] **Step 4: `DocumentRow.tsx`**

```tsx
// Old:
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border last:border-0 hover:bg-surface lg:flex-row lg:items-center lg:gap-4">

// New:
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border last:border-0 transition-colors duration-150 hover:bg-surface lg:flex-row lg:items-center lg:gap-4">
```

```tsx
// Old:
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Télécharger"
        >

// New:
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
          aria-label="Télécharger"
        >
```

- [ ] **Step 5: `ActivityItem.tsx`**

```tsx
// Old:
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">

// New:
    <div className="flex items-start gap-3 py-3 px-2 -mx-2 border-b border-border last:border-b-0 rounded-sm transition-colors duration-150 hover:bg-input/40">
```

- [ ] **Step 6: `CommentThread.tsx`**

```tsx
// Old:
    <div className={`flex gap-4 p-4 border border-border rounded-md bg-surface ${priorityClass}`}>

// New:
    <div
      className={`flex gap-4 p-4 border border-border rounded-md bg-surface transition-shadow duration-150 motion-safe:hover:shadow-md ${priorityClass}`}
    >
```

```tsx
// Old:
            className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full ${statusBg} disabled:opacity-50`}

// New:
            className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition-colors duration-150 motion-safe:active:scale-90 ${statusBg} disabled:opacity-50`}
```

- [ ] **Step 7: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, visit `/dashboard`, `/students`, `/documents`, `/comments`, `/deadlines`. Hover each card/row type and confirm a smooth, subtle lift/shadow/background-tint — nothing jarring, nothing that shifts layout (translate/shadow only, no width/height change).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/dashboard/StatCard.tsx frontend/src/components/dashboard/StudentRow.tsx frontend/src/components/dashboard/DeadlineCard.tsx frontend/src/components/dashboard/DocumentRow.tsx frontend/src/components/dashboard/ActivityItem.tsx frontend/src/components/dashboard/CommentThread.tsx
git commit -m "feat(ui): hover/transition micro-interactions on Encadrant shared cards and rows"
```

---

## Task 14: Animations — modals

All 4 modals (`AddStudentForm`, `AddDeadlineForm`, `AddToCalendarModal`, `PasswordSettingsModal`) share the same backdrop+panel structure. Backdrop fades in, panel scales in — both from Task 3's tokens, both `motion-safe:`-guarded.

**Files:**
- Modify: `frontend/src/components/dashboard/AddStudentForm.tsx`
- Modify: `frontend/src/components/dashboard/AddDeadlineForm.tsx`
- Modify: `frontend/src/components/student/AddToCalendarModal.tsx`
- Modify: `frontend/src/components/dashboard/PasswordSettingsModal.tsx`

- [ ] **Step 1: `AddStudentForm.tsx`**

```tsx
// Old:
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-surface rounded-lg shadow-2xl w-96 max-w-full">

// New:
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 motion-safe:animate-fade-in">
      <div className="bg-surface rounded-lg shadow-2xl w-96 max-w-full motion-safe:animate-scale-in">
```

- [ ] **Step 2: `AddDeadlineForm.tsx`**

```tsx
// Old:
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-surface rounded-lg shadow-2xl w-96 max-w-full">

// New:
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 motion-safe:animate-fade-in">
      <div className="bg-surface rounded-lg shadow-2xl w-96 max-w-full motion-safe:animate-scale-in">
```

- [ ] **Step 3: `AddToCalendarModal.tsx`**

```tsx
// Old:
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-surface border border-border rounded-lg shadow-lg w-full max-w-md p-6 flex flex-col gap-5">

// New:
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 motion-safe:animate-fade-in">
      <div className="bg-surface border border-border rounded-lg shadow-lg w-full max-w-md p-6 flex flex-col gap-5 motion-safe:animate-scale-in">
```

- [ ] **Step 4: `PasswordSettingsModal.tsx`**

```tsx
// Old:
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-surface rounded-lg shadow-2xl w-96 max-w-full">

// New:
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 motion-safe:animate-fade-in">
      <div className="bg-surface rounded-lg shadow-2xl w-96 max-w-full motion-safe:animate-scale-in">
```

- [ ] **Step 5: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`. Open each of the 4 modals ("Ajouter un étudiant" on `/dashboard` or `/students`, "Ajouter une échéance" on `/deadlines`, "Ajouter au calendrier" from a student deadline card, "Changer le mot de passe" on `/settings`) — confirm each fades/scales in smoothly, not instantly, and closing still works normally (no lingering backdrop, no click-through issues).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/dashboard/AddStudentForm.tsx frontend/src/components/dashboard/AddDeadlineForm.tsx frontend/src/components/student/AddToCalendarModal.tsx frontend/src/components/dashboard/PasswordSettingsModal.tsx
git commit -m "feat(ui): fade+scale entrance animation on all 4 modals"
```

---

## Task 15: Animations — navigation chrome (Sidebar, mobile drawer, StudentNav, NotificationBell dropdown) + StudentNav mobile drawer

While reading `StudentNav.tsx` for this task, a real responsive gap was found: below the `md:` breakpoint, the middle nav links (`Mon mémoire`/`Documents`/`Commentaires`/`Calendrier`) are wrapped in `hidden md:flex` with **no mobile replacement** — unlike the Encadrant `DashboardShell`, which has a hamburger + slide-in drawer for the same problem. A student on a phone currently has no way to reach Documents/Commentaires/Calendrier from the nav at all. This task fixes it using the same drawer pattern as `DashboardShell`, reusing Task 3's `slide-in-left` keyframe.

**Files:**
- Modify: `frontend/src/components/dashboard/Sidebar.tsx`
- Modify: `frontend/src/components/dashboard/DashboardShell.tsx`
- Modify: `frontend/src/components/student/StudentNav.tsx`
- Modify: `frontend/src/components/student/NotificationBell.tsx`
- Modify (if needed): `frontend/src/components/ui/Icon.tsx`

- [ ] **Step 1: `Sidebar.tsx` — smooth the nav link highlight transition**

```tsx
// Old:
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                isActive
                  ? 'bg-primary-foreground text-primary'
                  : 'text-primary-foreground opacity-70'
              }`}
            >

// New:
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-primary-foreground text-primary'
                  : 'text-primary-foreground opacity-70 hover:opacity-100'
              }`}
            >
```

- [ ] **Step 2: `DashboardShell.tsx` — drawer slide-in, backdrop fade-in, nav link transition**

```tsx
// Old:
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 bg-primary flex flex-col">

// New:
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 bg-primary flex flex-col motion-safe:animate-slide-in-left">
```

```tsx
// Old:
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

// New:
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-primary-foreground text-primary'
                        : 'text-primary-foreground opacity-70 hover:opacity-100'
                    }`}
                  >
```

```tsx
// Old:
          <button
            type="button"
            className="flex-1 bg-black/40"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
          />

// New:
          <button
            type="button"
            className="flex-1 bg-black/40 motion-safe:animate-fade-in"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
          />
```

- [ ] **Step 3: `StudentNav.tsx` — add the mobile drawer**

```tsx
// Old:
'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from './NotificationBell';

interface StudentNavProps {
  name: string;
  active?: 'dashboard' | 'documents' | 'comments' | 'deadlines';
}

const NAV_LINKS: { id: 'documents' | 'comments' | 'deadlines'; href: string; label: string }[] = [
  { id: 'documents', href: '/documents', label: 'Documents' },
  { id: 'comments', href: '/comments', label: 'Commentaires' },
  { id: 'deadlines', href: '/deadlines', label: 'Calendrier' },
];

export function StudentNav({ name, active }: StudentNavProps) {
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
        {NAV_LINKS.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            className={
              active === link.id
                ? 'text-primary border-b-2 border-primary pb-0.5'
                : 'text-muted-foreground'
            }
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border">
          <Avatar name={name} className="h-8 w-8" />
          <div className="text-xs font-semibold text-foreground">{name}</div>
        </div>
      </div>
    </nav>
  );
}

// New:
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from './NotificationBell';

interface StudentNavProps {
  name: string;
  active?: 'dashboard' | 'documents' | 'comments' | 'deadlines';
}

const NAV_LINKS: { id: 'documents' | 'comments' | 'deadlines'; href: string; label: string }[] = [
  { id: 'documents', href: '/documents', label: 'Documents' },
  { id: 'comments', href: '/comments', label: 'Commentaires' },
  { id: 'deadlines', href: '/deadlines', label: 'Calendrier' },
];

export function StudentNav({ name, active }: StudentNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="md:hidden text-foreground"
        >
          <Icon i="menu" size={20} />
        </button>
        <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
            <Icon i="graduation-cap" size={14} className="text-primary-foreground" />
          </div>
          <span className="hidden sm:inline text-base font-semibold font-headings text-foreground">
            ThèseFacile
          </span>
        </Link>
      </div>

      <div className="hidden md:flex items-center gap-6 text-sm font-medium">
        <Link
          href="/dashboard"
          className={`transition-colors duration-150 ${
            active === 'dashboard'
              ? 'text-primary border-b-2 border-primary pb-0.5'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Mon mémoire
        </Link>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            className={`transition-colors duration-150 ${
              active === link.id
                ? 'text-primary border-b-2 border-primary pb-0.5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border">
          <Avatar name={name} className="h-8 w-8" />
          <div className="text-xs font-semibold text-foreground">{name}</div>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 bg-primary flex flex-col motion-safe:animate-slide-in-left">
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
              <Link
                href="/dashboard"
                onClick={() => setDrawerOpen(false)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                  active === 'dashboard'
                    ? 'bg-primary-foreground text-primary'
                    : 'text-primary-foreground opacity-70 hover:opacity-100'
                }`}
              >
                Mon mémoire
              </Link>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                    active === link.id
                      ? 'bg-primary-foreground text-primary'
                      : 'text-primary-foreground opacity-70 hover:opacity-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <button
            type="button"
            className="flex-1 bg-black/40 motion-safe:animate-fade-in"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}
    </nav>
  );
}
```

Confirm `Icon.tsx`'s `ICONS` map already has a `menu` entry before relying on it:

Run: `grep -n "'menu'" frontend/src/components/ui/Icon.tsx`

If it's missing, add `menu: Menu,` (importing `Menu` from `lucide-react`, same pattern as every other entry in that file) — follow the file's existing alphabetical-ish list convention.

- [ ] **Step 4: `NotificationBell.tsx` — dropdown entrance**

```tsx
// Old:
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface border border-border rounded-md shadow-lg z-50">

// New:
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface border border-border rounded-md shadow-lg z-50 motion-safe:animate-slide-up">
```

- [ ] **Step 5: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev` at a mobile viewport (375px, devtools): confirm the Encadrant hamburger drawer still slides in smoothly; confirm the **new** Étudiant hamburger (visible next to the logo below `md:`) opens a matching drawer with all 4 links, closes on link click / backdrop click / the X button. At desktop width, confirm the Étudiant top nav is unchanged. Open the notification bell on any page and confirm the dropdown slides down smoothly.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/dashboard/Sidebar.tsx frontend/src/components/dashboard/DashboardShell.tsx frontend/src/components/student/StudentNav.tsx frontend/src/components/student/NotificationBell.tsx frontend/src/components/ui/Icon.tsx
git commit -m "feat(nav): mobile drawer for StudentNav, entrance animations for drawers/dropdown"
```

---

## Task 16: Animations — Étudiant shared components

**Files:**
- Modify: `frontend/src/components/student/StudentDeadlineCard.tsx`
- Modify: `frontend/src/components/student/StudentDocumentRow.tsx`
- Modify: `frontend/src/components/student/StudentCommentItem.tsx`

- [ ] **Step 1: `StudentDeadlineCard.tsx`**

```tsx
// Old:
    <div className={`flex items-start gap-4 p-4 border rounded-md ${URGENCY_CLASS[bucket]}`}>

// New:
    <div
      className={`flex items-start gap-4 p-4 border rounded-md transition-shadow duration-150 motion-safe:hover:shadow-md ${URGENCY_CLASS[bucket]}`}
    >
```

- [ ] **Step 2: `StudentDocumentRow.tsx`**

```tsx
// Old:
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0">

// New:
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 transition-colors duration-150 hover:bg-input/40">
```

- [ ] **Step 3: `StudentCommentItem.tsx`**

```tsx
// Old:
    <div
      className={`px-5 py-4 border-b border-border last:border-0 ${comment.resolved ? 'opacity-60' : ''}`}
    >

// New:
    <div
      className={`px-5 py-4 border-b border-border last:border-0 transition-colors duration-150 hover:bg-input/30 ${comment.resolved ? 'opacity-60' : ''}`}
    >
```

- [ ] **Step 4: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, sign in as an Étudiant, visit `/dashboard`, `/documents`, `/comments`, `/deadlines`, hover each row/card, confirm smooth subtle feedback.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/student/StudentDeadlineCard.tsx frontend/src/components/student/StudentDocumentRow.tsx frontend/src/components/student/StudentCommentItem.tsx
git commit -m "feat(ui): hover/transition micro-interactions on Étudiant shared cards and rows"
```

---

## Task 17: Animations — marketing homepage (`/`)

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Hero primary CTA**

```tsx
// Old:
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 rounded-sm bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground"
            >
              <Icon i="arrow-right" size={14} />
              Commencer gratuitement
            </Link>

// New:
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 rounded-sm bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98]"
            >
              <Icon i="arrow-right" size={14} />
              Commencer gratuitement
            </Link>
```

- [ ] **Step 2: Feature cards**

```tsx
// Old:
            <div key={f.title} className="rounded-md border border-border bg-background p-6">

// New:
            <div
              key={f.title}
              className="rounded-md border border-border bg-background p-6 transition-shadow transition-transform duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md"
            >
```

- [ ] **Step 3: Testimonial cards**

```tsx
// Old:
            <div
              key={t.name}
              className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6"
            >

// New:
            <div
              key={t.name}
              className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6 transition-shadow transition-transform duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md"
            >
```

- [ ] **Step 4: Pricing cards + CTAs**

```tsx
// Old:
            <div
              key={p.name}
              className={`flex flex-col gap-4 rounded-md p-6 ${
                p.primary
                  ? 'border-2 border-primary bg-primary text-primary-foreground'
                  : 'border border-border bg-background'
              }`}
            >

// New:
            <div
              key={p.name}
              className={`flex flex-col gap-4 rounded-md p-6 transition-shadow transition-transform duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md ${
                p.primary
                  ? 'border-2 border-primary bg-primary text-primary-foreground'
                  : 'border border-border bg-background'
              }`}
            >
```

```tsx
// Old:
              <Link
                href="/signup"
                className={`mt-2 rounded-sm py-2.5 text-center text-sm font-medium ${
                  p.primary
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {p.cta}
              </Link>

// New:
              <Link
                href="/signup"
                className={`mt-2 rounded-sm py-2.5 text-center text-sm font-medium transition-transform duration-150 motion-safe:active:scale-[0.98] ${
                  p.primary
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {p.cta}
              </Link>
```

- [ ] **Step 5: Final CTA**

```tsx
// Old:
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-8 py-4 text-sm font-medium text-primary-foreground"
        >
          <Icon i="arrow-right" size={14} />
          Créer mon compte gratuitement
        </Link>

// New:
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-8 py-4 text-sm font-medium text-primary-foreground transition-transform duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98]"
        >
          <Icon i="arrow-right" size={14} />
          Créer mon compte gratuitement
        </Link>
```

- [ ] **Step 6: Typecheck and manual check**

Run: `pnpm typecheck`
Expected: PASS.

`pnpm dev`, visit `/` logged out, hover the hero CTA, feature cards, testimonial cards, pricing cards, final CTA — confirm subtle lift/shadow, no layout shift, buttons compress slightly on click.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(ui): hover/transition micro-interactions on marketing homepage"
```

---

## Task 18: Animations — recipe sweep on the remaining interactive surfaces

The components touched in Tasks 13–17 cover every page that composes them, which is most of the app. This task applies the **exact same, already-established recipe** — no new classes, no new keyframes — to the remaining page-local buttons/inputs that Tasks 13–17 don't reach: `/login`, `/signup`, `/settings` (page-level tab/toggle buttons, not the header from Task 10 or the modal from Task 14), `EncadrantMessagingContent.tsx` (composer/quick-action buttons, not the header from Task 11), `StudentMessagingContent.tsx`, `StudentFileUploadForm.tsx`.

**Recipe** (copy verbatim, matching the element type):
- Primary submit button (`bg-primary text-primary-foreground`, any `rounded-sm`/`rounded-md`): append `transition-transform duration-150 motion-safe:active:scale-[0.98]`.
- Secondary/outline button (`border border-border`): append `transition-colors duration-150 hover:bg-input`.
- Text input / textarea / select (`border border-border ... bg-input` or `bg-background`): append `transition-colors duration-150 focus:border-primary`.
- Any element already carrying `hover:` classes without a `transition-*` class: append the matching `transition-colors duration-150` (color) or `transition-transform duration-150` (transform) — never invent a hover effect that wasn't already coded.

**Files:**
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/signup/page.tsx`
- Modify: `frontend/src/app/settings/page.tsx`
- Modify: `frontend/src/components/dashboard/EncadrantMessagingContent.tsx`
- Modify: `frontend/src/components/student/StudentMessagingContent.tsx`
- Modify: `frontend/src/components/student/StudentFileUploadForm.tsx`

- [ ] **Step 1: Find every primary/secondary button and input in each file**

Run (from repo root):

```bash
grep -n 'className=.*\(bg-primary\|border-border\).*rounded' frontend/src/app/login/page.tsx frontend/src/app/signup/page.tsx frontend/src/app/settings/page.tsx frontend/src/components/dashboard/EncadrantMessagingContent.tsx frontend/src/components/student/StudentMessagingContent.tsx frontend/src/components/student/StudentFileUploadForm.tsx
```

This lists every candidate line with its line number.

- [ ] **Step 2: Apply the recipe to each match**

For each line found in Step 1, open the file at that line, identify which of the 4 recipe categories it matches (primary button / secondary button / input / already-has-hover), and append the matching classes to the `className` string — exactly as done in Tasks 13–17 (append to the existing string, don't reorder or remove existing classes). Do not touch lines that aren't interactive elements (e.g. static badges, disabled/decorative buttons already handled in earlier tasks like the "Bientôt disponible" ones — those intentionally stay non-interactive, skip them).

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Manual check**

`pnpm dev`, visit `/login`, `/signup`, `/settings` (both Paramètres and Profil tabs), `/messages` as both an Encadrant and (with an assigned thesis) an Étudiant, and `/documents/new` as an Étudiant. Hover/click every button and input touched in Step 2, confirm smooth transitions, no layout shift, no broken styling (a stray missing space between appended classes is the most likely mistake — re-check each edited `className` string).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/login/page.tsx frontend/src/app/signup/page.tsx frontend/src/app/settings/page.tsx frontend/src/components/dashboard/EncadrantMessagingContent.tsx frontend/src/components/student/StudentMessagingContent.tsx frontend/src/components/student/StudentFileUploadForm.tsx
git commit -m "feat(ui): apply established hover/transition recipe to remaining interactive surfaces"
```

---

## Task 19: Responsive audit — real browser check at 375/768/1280px, app-wide

Same method as the project's own Phase 12 (`.planning/banani/STATUS.md`): Playwright driving the existing system Chrome against `pnpm dev`, automated `scrollWidth` vs `clientWidth` overflow check at each breakpoint, plus a visual pass on pages touched by this plan.

**Files:**
- No specific files up front — fixes depend on what the audit finds. Likely candidates given the components touched by this plan: `DashboardHeader.tsx` (new search bar at narrow widths), `StudentNav.tsx` (new drawer button spacing).

- [ ] **Step 1: Install Playwright as a temporary devDependency**

Playwright is not currently installed in this repo (confirmed: no `playwright` entry in `frontend/package.json`, not present in `node_modules`). Install it scoped to the frontend workspace for this task only — it gets removed in Step 7, so it never appears in the committed `package.json`:

Run: `pnpm --filter frontend add -D playwright`
Expected: install succeeds, `frontend/package.json`'s `devDependencies` gains a `playwright` line (temporary — do not commit this yet).

Run: `pnpm --filter frontend exec playwright install chromium`
Expected: downloads a Chromium build for Playwright to drive (this repo's prior QA passes used the machine's existing system Chrome via a different invocation; installing Playwright's own Chromium here is simpler and self-contained — either works, this is the lower-friction default).

- [ ] **Step 2: Write the audit script**

Create a throwaway script (not committed — matches the project's own precedent of temporary Playwright scripts for QA passes) at `frontend/scratch-responsive-audit.mjs`:

```js
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

// Adjust this list to real, currently-reachable paths for a seeded
// Encadrant + Étudiant account signed in via the dev server's cookies.
const PATHS = [
  '/',
  '/login',
  '/signup',
  '/dashboard',
  '/students',
  '/documents',
  '/comments',
  '/deadlines',
  '/messages',
  '/settings',
];

const browser = await chromium.launch();
const page = await browser.newPage();
const overflows = [];

for (const path of PATHS) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (scrollWidth > clientWidth) {
      overflows.push({ path, viewport: vp.name, scrollWidth, clientWidth });
    }
  }
}

console.log(JSON.stringify(overflows, null, 2));
await browser.close();
```

- [ ] **Step 3: Run it against a live dev server**

In one terminal: `pnpm dev`
In another: `node frontend/scratch-responsive-audit.mjs`

Expected output: `[]` (empty array = no horizontal overflow found). If any entries print, each `{ path, viewport }` pair needs a fix — go to Step 4.

- [ ] **Step 4: Fix any overflow found, using the project's existing idioms**

For each `{ path, viewport }` reported, open that page/component in a real browser at that exact viewport width and find the overflowing element (devtools → toggle-device-toolbar → inspect). Apply whichever of the codebase's own already-established patterns fits:
- Wrap a wide row/table in `overflow-x-auto` (already used in `StudentRow`'s table wrapper, `documents/page.tsx`'s table).
- Change a `flex` row to `flex-col sm:flex-row` (already the dominant pattern in every page header/section in this codebase).
- Add `min-w-0` to a flex child whose text is pushing the row wider than its container (already used throughout — e.g. `StudentRow`'s name/topic column).
- Add `truncate` to single-line text that's overflowing instead of wrapping.

Do not invent a new responsive strategy — every page in this app already follows one of these 4 patterns; matching them keeps the codebase consistent.

- [ ] **Step 5: Re-run the audit until it returns `[]`**

Run: `node frontend/scratch-responsive-audit.mjs`
Expected: `[]`.

- [ ] **Step 6: Visual pass on the pages this plan touched**

With the dev server running, manually resize the browser (or devtools device toolbar) through 375 → 768 → 1280 on: `/dashboard` (search bar + stage filter + rappels button), `/students` (search bar), `/students/[id]` (breadcrumb header), the 4 modals from Task 14, the Étudiant mobile drawer from Task 15. Confirm nothing clips, no text overlaps, no button becomes unreachable.

- [ ] **Step 7: Delete the throwaway script and remove the temporary Playwright dependency**

```bash
rm frontend/scratch-responsive-audit.mjs
pnpm --filter frontend remove playwright
```

Run: `git status`
Expected: `frontend/package.json` and `pnpm-lock.yaml` show playwright removed (back to their state before Step 1); `frontend/scratch-responsive-audit.mjs` is gone and does not appear as untracked. Confirm neither `playwright` nor the script path appears anywhere in `git diff` before committing anything from this task.

- [ ] **Step 8: Commit any fixes from Step 4**

```bash
git add -A
git status
```

Review the diff — commit only the actual page/component fixes (the audit script was already deleted in Step 6 and should not appear in `git status`).

```bash
git commit -m "fix(responsive): resolve horizontal overflow found in app-wide 375/768/1280 audit"
```

(Skip this step entirely if Step 3's first run already returned `[]` — nothing to commit.)

---

## Task 20: Final QA

- [ ] **Step 1: Full verification suite**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all four green, test count ≥ 695 (694 pre-existing + 6 new `nav-active.test.ts` tests), no regressions.

- [ ] **Step 2: Production build**

Run: `pnpm build`
Expected: succeeds, no new warnings about the modified pages.

- [ ] **Step 3: Grep verification — no "Année" text remains**

Run: `grep -rn "Année 2024" frontend/src`
Expected: no output.

- [ ] **Step 4: Grep verification — no duplicated nav-active logic remains**

Run: `grep -rn "pathname === item.href" frontend/src`
Expected: no output (both call sites now use `isNavItemActive`).

- [ ] **Step 5: Manual walkthrough — Encadrant**

With `pnpm dev` running and a seeded Encadrant account: sign in → `/dashboard` (search, stage filter, rappels button, bell) → click through every sidebar item (`/students`, `/documents`, `/comments`, `/deadlines`, `/messages`, `/settings`) confirming **only the current page's nav item is highlighted at each step** (this is the direct verification of the originally-reported bug) → open a student detail page and confirm the breadcrumb → add a student, add a deadline, change password (each modal opens/closes cleanly) → repeat the nav-highlight check via the mobile drawer at 375px.

- [ ] **Step 6: Manual walkthrough — Étudiant**

Sign in with an Étudiant account that has an assigned thesis: `/dashboard` → `/documents` → `/comments` (post a reply) → `/deadlines` (add to calendar) → `/messages`. At 375px, confirm the new hamburger drawer works and highlights the correct link on each page.

- [ ] **Step 7: Manual walkthrough — public**

Logged out: `/` → hover through hero/feature/testimonial/pricing cards and CTAs → `/login` → `/signup`.

- [ ] **Step 8: Final commit (if Step 1's `pnpm format` produced any formatting-only diffs not yet committed)**

```bash
git status
```

If clean, nothing to do. If Prettier reformatted anything from earlier tasks:

```bash
git add -A
git commit -m "chore: apply pnpm format"
```
