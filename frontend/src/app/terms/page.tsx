// Conditions d'utilisation — Banani screen "Conditions d'utilisation"
// (new_screen4.jsx). See .planning/banani/phase-2-auth-onboarding.md.
// Server component — fully static, no interactivity beyond anchor links.
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { MarketingNav } from '@/components/marketing/MarketingNav';

const SECTIONS = [
  {
    id: '1',
    title: "1. Objet et champ d'application",
    content:
      "Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'utilisation de la plateforme ThèseFacile, éditée par ThèseFacile SAS. En accédant au service, l'utilisateur accepte sans réserve les présentes conditions. ThèseFacile est un outil de suivi académique destiné exclusivement aux encadrants universitaires reconnus par leur institution.",
  },
  {
    id: '2',
    title: '2. Accès au service',
    content:
      "L'accès au service est réservé aux encadrants (enseignants-chercheurs, maîtres de conférences, professeurs) ayant créé un compte vérifié. Chaque utilisateur est responsable de la confidentialité de ses identifiants. ThèseFacile se réserve le droit de suspendre tout compte dont l'utilisation serait contraire aux présentes conditions ou aux bonnes mœurs universitaires.",
  },
  {
    id: '3',
    title: '3. Description du service',
    content:
      "ThèseFacile met à disposition une plateforme permettant le suivi de mémoires et thèses universitaires, incluant : le dépôt et la gestion de versions de documents, l'annotation et les commentaires contextuels, la gestion des échéances, et le tableau de bord de progression des étudiants encadrés. Le service est accessible via navigateur web, optimisé pour une utilisation sur connexions 3G.",
  },
  {
    id: '4',
    title: '4. Données personnelles et confidentialité',
    content:
      "ThèseFacile collecte les données strictement nécessaires au fonctionnement du service : nom, prénom, adresse email institutionnelle, documents académiques déposés. Ces données sont hébergées sur des serveurs sécurisés. Aucune donnée n'est partagée avec des tiers à des fins commerciales. Conformément aux législations en vigueur au Sénégal, en Côte d'Ivoire et au Cameroun, l'utilisateur dispose d'un droit d'accès, de rectification et de suppression de ses données.",
  },
  {
    id: '5',
    title: '5. Propriété intellectuelle',
    content:
      "Les documents déposés sur la plateforme restent la propriété intellectuelle exclusive de leurs auteurs. ThèseFacile n'acquiert aucun droit sur les contenus académiques déposés. La plateforme, son interface et ses fonctionnalités sont la propriété de ThèseFacile SAS et sont protégés par les droits de propriété intellectuelle applicables.",
  },
  {
    id: '6',
    title: '6. Responsabilités et garanties',
    content:
      "ThèseFacile s'engage à assurer la disponibilité du service et la sécurité des données dans la limite du possible. La plateforme ne saurait être tenue responsable des interruptions liées à des problèmes de connectivité, de force majeure, ou de maintenance planifiée. L'encadrant reste seul responsable du suivi académique de ses étudiants ; la plateforme est un outil d'aide et ne se substitue pas au jugement professionnel de l'enseignant.",
  },
  {
    id: '7',
    title: '7. Tarification et paiement',
    content:
      "L'accès au service est soumis à un abonnement mensuel payant selon le plan choisi (Essentiel, Pro, Département). Le paiement s'effectue par mobile money (Orange Money, Wave, MTN MoMo) ou par virement bancaire. Aucun remboursement ne sera accordé pour les périodes entamées. ThèseFacile se réserve le droit de modifier ses tarifs avec un préavis de 30 jours.",
  },
  {
    id: '8',
    title: '8. Résiliation',
    content:
      "L'utilisateur peut résilier son abonnement à tout moment depuis ses paramètres de compte. La résiliation prend effet à l'issue de la période d'abonnement en cours. ThèseFacile peut résilier un compte sans préavis en cas de violation grave des présentes conditions. Les données de l'utilisateur sont conservées 90 jours après résiliation, puis supprimées définitivement.",
  },
  {
    id: '9',
    title: '9. Modifications des CGU',
    content:
      "ThèseFacile se réserve le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront informés de toute modification substantielle par email. La poursuite de l'utilisation du service après notification vaut acceptation des nouvelles conditions.",
  },
  {
    id: '10',
    title: '10. Droit applicable et litiges',
    content:
      "Les présentes CGU sont soumises au droit sénégalais. En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut d'accord amiable, le litige sera soumis à la compétence exclusive des tribunaux de Dakar, Sénégal.",
  },
];

export default function TermsPage() {
  return (
    <div className="font-body bg-background text-foreground">
      <MarketingNav />

      {/* HERO HEADER */}
      <div className="border-b border-border bg-surface px-4 py-10 sm:px-8 lg:px-16 lg:py-14">
        <div className="max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <div className="h-px w-6 bg-primary" />
            Légal
          </div>
          <h1 className="mb-3 font-headings text-3xl font-semibold text-foreground lg:text-4xl">
            Conditions d&apos;utilisation
          </h1>
          <p className="text-sm text-muted-foreground">Dernière mise à jour : 1er janvier 2025</p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Veuillez lire attentivement ces conditions avant d&apos;utiliser ThèseFacile. Elles
            définissent vos droits et obligations en tant qu&apos;encadrant utilisateur de la
            plateforme.
          </p>
        </div>
      </div>

      {/* BODY */}
      <div className="flex flex-col gap-8 px-4 py-10 sm:px-8 lg:flex-row lg:items-start lg:gap-12 lg:px-16 lg:py-12">
        {/* TABLE OF CONTENTS */}
        <div className="lg:w-56 lg:shrink-0">
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Sommaire
            </div>
            <div className="flex flex-col gap-1">
              {SECTIONS.map((s, i) => (
                <a
                  key={s.id}
                  href={`#section-${s.id}`}
                  className="flex items-start gap-2 py-1 text-xs text-muted-foreground"
                >
                  <span className="w-4 shrink-0 font-medium text-primary">{i + 1}.</span>
                  <span>{s.title.replace(/^\d+\.\s*/, '')}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Icon i="file-text" size={14} className="text-primary" />
              Version PDF
            </div>
            <button
              type="button"
              disabled
              title="Bientôt disponible"
              className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-sm bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              <Icon i="download" size={12} />
              Télécharger
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="max-w-2xl flex-1">
          <div className="mb-10 flex items-start gap-3 rounded-md border border-secondary bg-secondary p-4">
            <Icon i="info" size={16} className="mt-0.5 shrink-0 text-secondary-foreground" />
            <p className="text-sm leading-relaxed text-secondary-foreground">
              En créant un compte ou en continuant d&apos;utiliser ThèseFacile, vous confirmez avoir
              lu, compris et accepté l&apos;intégralité des présentes conditions d&apos;utilisation.
            </p>
          </div>

          <div className="flex flex-col gap-10">
            {SECTIONS.map((s, i) => (
              <div
                key={s.id}
                id={`section-${s.id}`}
                className={i < SECTIONS.length - 1 ? 'border-b border-border pb-10' : ''}
              >
                <h2 className="mb-3 font-headings text-base font-semibold text-foreground">
                  {s.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.content}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col gap-4 rounded-md border border-border bg-surface p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
                <Icon i="check-circle" size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  J&apos;accepte les conditions d&apos;utilisation
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  En continuant, vous acceptez les CGU et la politique de confidentialité
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-2 sm:flex-row">
              <Link
                href="/signup"
                className="flex-1 rounded-sm bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground"
              >
                Créer mon compte
              </Link>
              <Link
                href="/"
                className="flex-1 rounded-sm border border-border py-2.5 text-center text-sm font-medium text-foreground"
              >
                Revenir à l&apos;accueil
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-6 border-t border-border px-4 py-8 sm:px-8 lg:px-16">
        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2025 ThèseFacile. Tous droits réservés.</span>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <span className="text-primary">Politique de confidentialité</span>
            <span>Mentions légales</span>
            <span>Contact</span>
            <span>Dakar · Abidjan · Yaoundé</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
