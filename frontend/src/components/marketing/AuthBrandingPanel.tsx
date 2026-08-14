// Shared left-hand branding panel for the auth split-screen layout
// (/login, /signup) — extracted from /login's original inline JSX once
// /signup needed the exact same panel (Phase 13). Static marketing copy,
// no props: both screens show the identical message/testimonial.
import { Icon } from '@/components/ui/Icon';

export function AuthBrandingPanel() {
  return (
    <div className="hidden w-2/5 shrink-0 flex-col justify-between bg-surface px-12 py-14 lg:flex">
      <div className="flex items-center">
        <img src="/logo.jpg" alt="ThèseFacile" className="h-9 w-auto" />
      </div>

      <div>
        <h2 className="mb-5 font-headings text-4xl font-semibold leading-tight text-foreground">
          Le suivi de thèses,
          <br />
          <span className="text-primary">enfin simple.</span>
        </h2>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Suivez en temps réel l&apos;avancement de vos étudiants, annotez leurs documents et ne
          manquez plus aucune échéance.
        </p>

        <div className="mt-10 border-l-2 border-primary pl-4">
          <p className="text-sm italic leading-relaxed text-muted-foreground">
            &quot;ThèseFacile m&apos;a permis de diviser par deux le temps que je passais à relancer
            mes étudiants.&quot;
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
              <Icon i="user" size={14} className="text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs font-medium text-foreground">Pr. Koné Aboubakar</div>
              <div className="text-xs text-muted-foreground">Université de Cocody, Abidjan</div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        © 2025 ThèseFacile — Conçu pour l&apos;Afrique francophone
      </div>
    </div>
  );
}
