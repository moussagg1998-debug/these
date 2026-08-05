// Shared chrome for every student-facing screen — pins StudentNav to the
// top of the viewport and makes only the content below it scrollable.
// Previously each Student*Content component built its own
// `min-h-screen` wrapper (a minimum height, not a clip), so the whole
// document scrolled as one block, StudentNav included.
'use client';

import type { ReactNode } from 'react';
import { StudentNav } from './StudentNav';

interface StudentShellProps {
  name: string;
  active?: 'dashboard' | 'documents' | 'comments' | 'deadlines';
  children: ReactNode;
}

export function StudentShell({ name, active, children }: StudentShellProps) {
  return (
    <div className="font-body bg-background h-dvh flex flex-col overflow-hidden">
      <StudentNav name={name} {...(active ? { active } : {})} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
