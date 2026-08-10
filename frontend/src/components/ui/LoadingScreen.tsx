// Full-viewport loading gate — shown while a page's useUser()/useApi()
// pre-content checks are pending. Was previously duplicated as a bare
// "Chargement…" <p> across every gated page; extracted once a spinner was
// added so the visual (icon + text) only needs to change in one place.
import { Icon } from '@/components/ui/Icon';

export function LoadingScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Icon i="loader" size={22} className="text-primary motion-safe:animate-spin" />
      <p className="text-sm text-muted-foreground">Chargement…</p>
    </main>
  );
}
