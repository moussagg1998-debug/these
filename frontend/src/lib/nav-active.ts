// Single source of truth for "is this sidebar/nav link the current page" —
// previously duplicated verbatim in Sidebar.tsx and DashboardShell.tsx.
export function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
