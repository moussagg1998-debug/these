// Landing Page — Banani screen "Landing Page" (new_screen3.jsx).
// See .planning/banani/phase-2-auth-onboarding.md for the full plan.
// Server component: no client state needed at this level (MarketingNav
// carries its own 'use client' for the mobile menu toggle).
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { PricingCTA } from '@/components/marketing/PricingCTA';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// SoftwareApplication structured data: only real, already-displayed facts
// (name, description, the 3 real FCFA price tiers). No AggregateRating/
// Review block — the testimonials above aren't verified customer reviews,
// and fabricating a rating signal would be exactly the kind of "invented
// trust signal" SEO must never introduce.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ThèseFacile',
  description:
    "Le suivi de thèses pensé pour les encadrants d'Afrique francophone : dépôt et versioning des documents, commentaires contextuels, échéances et tableau de bord en temps réel.",
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    { '@type': 'Offer', name: 'Gratuit', price: '0', priceCurrency: 'XOF' },
    { '@type': 'Offer', name: 'Essentiel', price: '5900', priceCurrency: 'XOF' },
  ],
};

const FEATURES = [
  {
    icon: 'file-text',
    title: 'Versioning des documents',
    desc: "Chaque soumission est horodatée et archivée. Retrouvez en un clic l'historique complet d'un mémoire.",
  },
  {
    icon: 'message-square',
    title: 'Commentaires contextuels',
    desc: 'Annotez directement les parties du document. Vos retours sont liés au texte, pas perdus dans un email.',
  },
  {
    icon: 'bar-chart-2',
    title: 'Tableau de bord en temps réel',
    desc: "Voyez l'avancement de chaque étudiant d'un seul regard. Progression, étape, dernière soumission.",
  },
  {
    icon: 'bell',
    title: "Rappels d'échéances automatiques",
    desc: "Configurez des jalons par étudiant. ThèseFacile envoie les alertes — vous n'avez plus à relancer.",
  },
  {
    icon: 'smartphone',
    title: 'Pensé pour mobile',
    desc: "Interface légère, optimisée pour 3G. Consultez vos suivis entre deux cours, depuis n'importe où.",
  },
  {
    icon: 'shield-check',
    title: 'Données sécurisées',
    desc: 'Vos documents académiques sont hébergés en toute confidentialité. Aucun partage tiers.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      '"Avant ThèseFacile, je passais des heures à relancer mes étudiants par WhatsApp. Maintenant je vois tout sur une seule page."',
    name: 'Pr. Koné Aboubakar',
    role: 'Maître de conférences — Université de Cocody, Abidjan',
  },
  {
    quote:
      '"La fonctionnalité de commentaires contextuels a complètement changé ma façon de donner des retours à mes étudiants."',
    name: 'Dr. Aminata Touré',
    role: 'Enseignante-chercheuse — UCAD Dakar',
  },
  {
    quote:
      '"Le meilleur investissement pour ma charge de travail d\'encadrement. Mes étudiants aussi trouvent ça pratique."',
    name: 'Pr. Joseph Atangana',
    role: 'Professeur titulaire — Université de Yaoundé I',
  },
];

const PLANS = [
  {
    name: 'Gratuit',
    badge: '',
    tone: 'accent' as const,
    price: '0',
    unit: 'FCFA',
    period: '',
    desc: "Encadrant qui découvre l'outil",
    features: [
      { icon: 'users', label: '2 étudiants, 50 Mo' },
      { icon: 'layout-dashboard', label: 'Cœur produit complet' },
      { icon: 'archive', label: 'Archivage permanent' },
    ],
    excluded: ['Rappels groupés', 'Support prioritaire'],
    reassurance: 'Aucune carte bancaire requise',
    recommended: false,
    cta: 'Commencer gratuitement',
  },
  {
    name: 'Essentiel',
    badge: 'Offre Or',
    tone: 'gold' as const,
    price: '5 900',
    unit: 'FCFA',
    period: '/ mois',
    desc: 'Encadrant avec une cohorte active',
    features: [
      { icon: 'users', label: '20 étudiants, 100 Go' },
      { icon: 'bell', label: 'Rappels groupés' },
      { icon: 'phone', label: 'Support prioritaire 24h' },
    ],
    excluded: [],
    reassurance: 'Paiement mobile money — sans engagement',
    recommended: true,
    cta: 'Choisir Essentiel',
  },
];

const STAT_ROWS = [
  { label: 'Étudiants', value: '12', sub: '' },
  { label: 'En attente', value: '7', sub: '4 urgents' },
  { label: 'Retards', value: '2', sub: 'Kouakou · Fall' },
];

const MOCK_STUDENTS = [
  { name: 'Fatou Sow', stage: 'Rédaction', progress: 62 },
  { name: 'Kofi Mensah', stage: 'Révision', progress: 81 },
  { name: 'Aïssatou Bah', stage: 'Soutenance', progress: 97 },
];

export default function LandingPage() {
  return (
    <div className="font-body bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <MarketingNav />

      {/* HERO */}
      <section className="flex flex-col gap-10 px-4 py-14 sm:px-8 md:py-20 lg:flex-row lg:items-start lg:gap-20 lg:px-16 lg:py-28">
        <div className="max-w-xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <div className="h-px w-6 bg-primary" />
            Pour les encadrants d&apos;Afrique francophone
          </div>
          <h1 className="mb-6 font-headings text-3xl font-semibold leading-tight text-foreground sm:text-4xl lg:text-5xl">
            Le suivi de thèses,
            <br />
            <span className="text-primary">enfin clair.</span>
          </h1>
          <p className="mb-8 text-base leading-relaxed text-muted-foreground lg:text-lg">
            ThèseFacile centralise le versioning de documents, les retours contextuels et les
            échéances de tous vos étudiants. Fini les relances WhatsApp, fini les fichiers perdus.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 rounded-sm bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98]"
            >
              <Icon i="arrow-right" size={14} />
              Commencer gratuitement
            </Link>
            <Link
              href="/demo"
              className="flex items-center justify-center gap-2 rounded-sm border border-border px-6 py-3.5 text-sm font-medium text-foreground"
            >
              <Icon i="user" size={14} />
              Voir la démo
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-4">
            <div className="flex -space-x-2">
              <Avatar name="Aminata Touré" className="h-8 w-8 border-2 border-background" />
              <Avatar name="Koné Aboubakar" className="h-8 w-8 border-2 border-background" />
              <Avatar name="Joseph Atangana" className="h-8 w-8 border-2 border-background" />
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">+340 encadrants</span> au Sénégal,
              Côte d&apos;Ivoire &amp; Cameroun
            </div>
          </div>
        </div>

        {/* Hero illustration — mock dashboard */}
        <div className="flex-1 rounded-lg border border-border bg-surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-primary">
              <Icon i="graduation-cap" size={10} className="text-primary-foreground" />
            </div>
            <span className="font-headings text-xs font-semibold text-foreground">ThèseFacile</span>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {STAT_ROWS.map((s) => (
              <div key={s.label} className="rounded-sm border border-border p-2 sm:p-3">
                <div className="mb-1 text-[10px] text-muted-foreground sm:text-xs">{s.label}</div>
                <div className="font-headings text-lg font-semibold text-foreground sm:text-2xl">
                  {s.value}
                </div>
                <div className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{s.sub}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {MOCK_STUDENTS.map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-3 rounded-sm border border-border px-3 py-2"
              >
                <Avatar name={s.name} className="h-7 w-7 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.stage}</div>
                </div>
                <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-input sm:block">
                  <div
                    className="h-full bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
                <div className="w-8 text-right text-xs text-muted-foreground">{s.progress}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="fonctionnalites"
        className="border-t border-border bg-surface px-4 py-16 sm:px-8 lg:px-16 lg:py-24"
      >
        <div className="mb-12 text-center lg:mb-16">
          <div className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">
            Fonctionnalités
          </div>
          <h2 className="font-headings text-2xl font-semibold text-foreground lg:text-3xl">
            Tout ce dont vous avez besoin,
            <br />
            rien de superflu.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-md border border-border bg-background p-6 transition-[translate,box-shadow] duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
                <Icon i={f.icon} size={20} />
              </div>
              <h3 className="mb-2 font-headings text-sm font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section
        id="temoignages"
        className="border-t border-border px-4 py-16 sm:px-8 lg:px-16 lg:py-24"
      >
        <div className="mb-12 text-center lg:mb-16">
          <div className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">
            Témoignages
          </div>
          <h2 className="font-headings text-2xl font-semibold text-foreground lg:text-3xl">
            Ce que disent nos encadrants
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6 transition-[translate,box-shadow] duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md"
            >
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Icon key={j} i="star" size={14} className="text-primary" />
                ))}
              </div>
              <p className="flex-1 text-sm italic leading-relaxed text-foreground">{t.quote}</p>
              <div className="flex items-center gap-3 border-t border-border pt-3">
                <Avatar name={t.name} className="h-9 w-9 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section
        id="tarifs"
        className="border-t border-border bg-surface px-4 py-16 sm:px-8 lg:px-16 lg:py-24"
      >
        <div className="mb-12 text-center lg:mb-16">
          <div className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">
            Tarifs
          </div>
          <h2 className="font-headings text-2xl font-semibold text-foreground lg:text-3xl">
            Un prix adapté à chaque usage
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Paiement par mobile money (Orange Money, Wave, MTN). Sans engagement.
          </p>
        </div>
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col gap-5 rounded-md bg-surface p-6 pt-8 transition-[translate,box-shadow] duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md ${
                p.recommended ? 'border-2 border-gold' : 'border border-border'
              }`}
            >
              {p.badge && (
                <span
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                    p.tone === 'gold'
                      ? 'bg-gold text-gold-foreground'
                      : 'bg-accent text-accent-foreground'
                  }`}
                >
                  {p.badge}
                </span>
              )}

              <div>
                <div className="mb-3 font-headings text-xl font-semibold text-foreground">
                  {p.name}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`font-headings text-3xl font-semibold ${
                      p.tone === 'gold' ? 'text-gold' : 'text-accent'
                    }`}
                  >
                    {p.price}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.unit}
                    {p.period && ` ${p.period}`}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>

              <div className="flex flex-1 flex-col border-t border-border">
                {p.features.map((feat) => (
                  <div
                    key={feat.label}
                    className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        p.tone === 'gold' ? 'bg-gold/15 text-gold' : 'bg-accent/15 text-accent'
                      }`}
                    >
                      <Icon i={feat.icon} size={15} />
                    </span>
                    <span className="flex-1 text-sm text-foreground">{feat.label}</span>
                    <Icon i="check-circle" size={16} className="shrink-0 text-success" />
                  </div>
                ))}
                {p.excluded.map((label) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 border-b border-border/60 py-2.5 opacity-60 last:border-0"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon i="x" size={15} />
                    </span>
                    <span className="flex-1 text-sm text-muted-foreground line-through">
                      {label}
                    </span>
                    <Icon i="x" size={16} className="shrink-0 text-danger" />
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <PricingCTA
                  href="/signup"
                  loggedInHref={p.name === 'Essentiel' ? '/settings?tab=abonnement' : undefined}
                  className={`rounded-sm py-2.5 text-center text-sm font-medium transition duration-150 motion-safe:active:scale-[0.98] ${
                    p.recommended
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground hover:bg-input'
                  }`}
                >
                  {p.cta}
                </PricingCTA>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <Icon i="lock" size={11} />
                  {p.reassurance}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-border px-4 py-16 text-center sm:px-8 lg:px-16 lg:py-28">
        <h2 className="mb-4 font-headings text-2xl font-semibold text-foreground sm:text-3xl lg:text-4xl">
          Prêt à reprendre le contrôle
          <br />
          de vos encadrements ?
        </h2>
        <p className="mx-auto mb-8 max-w-md text-sm text-muted-foreground sm:text-base lg:mb-10">
          Rejoignez les encadrants d&apos;Afrique francophone qui ont dit au revoir aux relances
          WhatsApp.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-8 py-4 text-sm font-medium text-primary-foreground transition duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98]"
        >
          <Icon i="arrow-right" size={14} />
          Créer mon compte gratuitement
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
