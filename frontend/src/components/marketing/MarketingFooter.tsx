// Shared footer for Landing Page + Terms — same extraction rationale as
// MarketingNav.
import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="border-t border-border px-4 py-10 sm:px-8 lg:px-16">
      <div className="flex flex-col items-start justify-between gap-10 lg:flex-row">
        <div>
          <div className="mb-3">
            <img src="/logo.jpg" alt="ThèseFacile" className="h-7 w-auto" />
          </div>
          <p className="max-w-xs text-xs text-muted-foreground">
            Le suivi de thèses pensé pour les encadrants d&apos;Afrique francophone.
          </p>
        </div>
        <div className="flex flex-wrap gap-10 text-xs text-muted-foreground sm:gap-16">
          <div className="flex flex-col gap-2">
            <span className="mb-1 font-medium text-foreground">Produit</span>
            <a href="/#fonctionnalites">Fonctionnalités</a>
            <a href="/#tarifs">Tarifs</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="mb-1 font-medium text-foreground">Légal</span>
            <Link href="/terms">CGU</Link>
          </div>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© 2025 ThèseFacile. Tous droits réservés.</span>
        <span>Dakar · Abidjan · Yaoundé</span>
      </div>
    </footer>
  );
}
