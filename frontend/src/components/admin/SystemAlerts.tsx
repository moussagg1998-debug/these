// "Alertes système" — Option A scope. No alerting system exists anywhere
// in the codebase (no trial concept, no payment-failure event surfaced) —
// real empty state, not fabricated alerts (see
// .planning/banani/admin-dashboard.md).
export function SystemAlerts() {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-surface">
        <div className="text-sm font-semibold text-foreground">Alertes système</div>
      </div>
      <p className="px-4 py-4 text-xs text-muted-foreground motion-safe:animate-fade-in">
        Aucune alerte pour l&apos;instant.
      </p>
    </div>
  );
}
