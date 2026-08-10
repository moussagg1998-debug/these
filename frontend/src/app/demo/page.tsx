// Voir la démo — public, unauthenticated tour of the app. Reuses the
// landing page's MarketingNav/Footer chrome and the same "hardcoded mock
// data + plain markup" pattern as the landing page's hero dashboard
// preview (not the real DashboardShell/StudentShell components, which
// assume a live session and fetch real API data). Linked from the hero's
// "Voir la démo" CTA.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export const metadata: Metadata = {
  title: 'Démo',
  description:
    'Explorez le tableau de bord, le suivi Kanban, les documents et les échéances de ThèseFacile — sans créer de compte.',
  alternates: { canonical: '/demo' },
};

const NAV_SECTIONS = [
  { href: '#dashboard', label: 'Tableau de bord' },
  { href: '#kanban', label: 'Kanban' },
  { href: '#documents', label: 'Documents' },
  { href: '#commentaires', label: 'Commentaires' },
  { href: '#messagerie', label: 'Messagerie' },
  { href: '#echeances', label: 'Échéances' },
  { href: '#etudiant', label: 'Espace étudiant' },
  { href: '#securite', label: 'Sécurité' },
];

const DASH_STATS: { icon: string; label: string; value: string; sub: string }[] = [
  { icon: 'users', label: 'Étudiants suivis', value: '12', sub: '3 en soutenance' },
  {
    icon: 'message-square',
    label: 'Discussions actives',
    value: '8',
    sub: '23 commentaires au total',
  },
  { icon: 'file-up', label: 'Soumissions récentes', value: '5', sub: 'Cette semaine' },
  { icon: 'alert-triangle', label: 'Échéances urgentes', value: '2', sub: 'À moins de 3 jours' },
];

const DASH_STUDENTS = [
  {
    name: 'Fatou Sow',
    topic: "Impact du mobile money sur l'inclusion financière",
    stage: 'Rédaction',
    progress: 62,
    deadline: '12 sept.',
  },
  {
    name: 'Kofi Mensah',
    topic: 'Gouvernance des données de santé en Afrique de l’Ouest',
    stage: 'Révision',
    progress: 81,
    deadline: '18 sept.',
  },
  {
    name: 'Aïssatou Bah',
    topic: 'Résilience des systèmes agricoles face au changement climatique',
    stage: 'Soutenance',
    progress: 97,
    deadline: '2 oct.',
  },
  {
    name: 'Moussa Diallo',
    topic: "Traçabilité des chaînes d'approvisionnement par blockchain",
    stage: 'Bloqué',
    progress: 34,
    deadline: '—',
  },
];

const KANBAN_COLUMNS: { stage: string; badge: string; students: string[] }[] = [
  { stage: 'En attente', badge: 'bg-muted text-muted-foreground', students: ['Ibrahima Sarr'] },
  {
    stage: 'Rédaction',
    badge: 'bg-warning text-warning-foreground',
    students: ['Fatou Sow', 'Aminata Cissé'],
  },
  { stage: 'Révision', badge: 'bg-accent text-accent-foreground', students: ['Kofi Mensah'] },
  { stage: 'Soutenance', badge: 'bg-success text-success-foreground', students: ['Aïssatou Bah'] },
  { stage: 'Bloqué', badge: 'bg-danger text-danger-foreground', students: ['Moussa Diallo'] },
];

const DOCUMENTS = [
  {
    name: 'Chapitre_3_Methodologie.pdf',
    student: 'Fatou Sow',
    date: '2 sept.',
    size: '2,4 Mo',
  },
  {
    name: 'Revue_litterature_v2.docx',
    student: 'Kofi Mensah',
    date: '30 août',
    size: '1,1 Mo',
  },
  {
    name: 'Slides_soutenance.pptx',
    student: 'Aïssatou Bah',
    date: '28 août',
    size: '6,8 Mo',
  },
];

const COMMENTS: {
  author: string;
  priority: 'high' | null;
  resolved: boolean;
  body: string;
}[] = [
  {
    author: 'Pr. Koné Aboubakar',
    priority: 'high',
    resolved: false,
    body: 'Merci de préciser votre échantillon dans la section 3.2 — le lien avec l’hypothèse H1 n’est pas clair.',
  },
  {
    author: 'Fatou Sow',
    priority: null,
    resolved: false,
    body: 'Corrigé — j’ai ajouté un tableau récapitulatif en annexe B.',
  },
  {
    author: 'Pr. Koné Aboubakar',
    priority: null,
    resolved: true,
    body: 'Très bonne synthèse, rien à signaler sur ce chapitre.',
  },
];

const MESSAGES: {
  from: 'encadrant' | 'student';
  text: string;
  time: string;
  attachment?: string;
}[] = [
  {
    from: 'encadrant',
    text: 'Bonjour Fatou, avez-vous pu avancer sur le chapitre 4 ?',
    time: '09:14',
  },
  {
    from: 'student',
    text: 'Bonjour Professeur, oui — je viens de déposer une nouvelle version avec le tableau demandé.',
    time: '09:41',
    attachment: 'Chapitre_4_v3.pdf',
  },
  { from: 'encadrant', text: "Parfait, je regarde ça aujourd'hui.", time: '09:43' },
];

const DEADLINE_SECTIONS: {
  label: string;
  icon: string;
  tone: string;
  badge: string;
  items: { student: string; title: string; date: string }[];
}[] = [
  {
    label: 'En retard',
    icon: 'alert-triangle',
    tone: 'text-danger',
    badge: 'bg-danger/10 text-danger',
    items: [{ student: 'Moussa Diallo', title: 'Dépôt chapitre 2', date: '28 août' }],
  },
  {
    label: 'Urgent',
    icon: 'clock',
    tone: 'text-warning',
    badge: 'bg-warning/10 text-warning',
    items: [{ student: 'Fatou Sow', title: 'Dépôt chapitre 4', date: '12 sept.' }],
  },
  {
    label: 'À venir',
    icon: 'calendar',
    tone: 'text-foreground',
    badge: 'bg-secondary text-secondary-foreground',
    items: [{ student: 'Kofi Mensah', title: 'Relecture finale', date: '18 sept.' }],
  },
  {
    label: 'Respectées',
    icon: 'check-circle',
    tone: 'text-success',
    badge: 'bg-success/10 text-success',
    items: [{ student: 'Aïssatou Bah', title: 'Dépôt slides', date: '28 août' }],
  },
];

function SectionHeading({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="mb-8 max-w-2xl">
      <div className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">
        {eyebrow}
      </div>
      <h2 className="font-headings text-xl font-semibold text-foreground lg:text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

export default function DemoPage() {
  return (
    <div className="font-body bg-background text-foreground">
      <MarketingNav />

      {/* INTRO */}
      <section className="border-b border-border px-4 py-14 text-center sm:px-8 lg:px-16 lg:py-20">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">
            Démo
          </div>
          <h1 className="font-headings text-2xl font-semibold text-foreground sm:text-3xl lg:text-4xl">
            Visitez ThèseFacile, écran par écran
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground lg:text-base">
            Aucune inscription requise. Voici un aperçu fidèle de chaque espace de
            l&apos;application — côté encadrant et côté étudiant — avec des données fictives.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 rounded-sm bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98]"
            >
              <Icon i="arrow-right" size={14} />
              Créer mon compte gratuitement
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-sm border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-input"
            >
              Se connecter
            </Link>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 overflow-x-auto pb-1">
          {NAV_SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-primary"
            >
              {s.label}
            </a>
          ))}
        </div>
      </section>

      {/* DASHBOARD */}
      <section id="dashboard" className="px-4 py-14 sm:px-8 lg:px-16 lg:py-20">
        <SectionHeading
          eyebrow="Tableau de bord encadrant"
          title="Tout votre encadrement, en un coup d'œil"
          desc="KPIs en temps réel, liste de vos étudiants filtrable par étape, activité récente et prochaines échéances — tout ce qu'il faut voir d'abord en arrivant sur ThèseFacile."
        />
        <div className="rounded-lg border border-border bg-surface p-4 motion-safe:animate-fade-in sm:p-6">
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DASH_STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-md border border-border bg-background p-3 sm:p-4"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
                  <Icon i={s.icon} size={14} />
                </div>
                <div className="font-headings text-xl font-semibold text-foreground sm:text-2xl">
                  {s.value}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
                <div className="mt-0.5 hidden text-xs text-muted-foreground/70 sm:block">
                  {s.sub}
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border border-border bg-background">
            <div className="min-w-[640px]">
              <div className="hidden items-center gap-4 border-b border-border bg-input px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:flex">
                <div className="w-52 shrink-0">Étudiant · Sujet</div>
                <div className="w-24 shrink-0">Étape</div>
                <div className="w-32 shrink-0">Avancement</div>
                <div className="flex-1">Échéance</div>
              </div>
              {DASH_STUDENTS.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <div className="flex w-52 shrink-0 items-center gap-2.5 min-w-0">
                    <Avatar name={s.name} className="h-8 w-8 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{s.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.topic}</div>
                    </div>
                  </div>
                  <div className="w-24 shrink-0">
                    <span className="inline-block rounded-sm bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {s.stage}
                    </span>
                  </div>
                  <div className="flex w-32 shrink-0 items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-input">
                      <div className="h-full bg-primary" style={{ width: `${s.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{s.progress}%</span>
                  </div>
                  <div className="flex-1 text-xs text-muted-foreground">{s.deadline}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* KANBAN */}
      <section
        id="kanban"
        className="border-t border-border bg-surface px-4 py-14 sm:px-8 lg:px-16 lg:py-20"
      >
        <SectionHeading
          eyebrow="Vue Kanban"
          title="Glissez-déposez pour faire avancer une thèse"
          desc="Chaque étape (En attente, Rédaction, Révision, Soutenance, Bloqué) est une colonne. Le passage vers « Bloqué » demande une confirmation explicite avant d'être appliqué."
        />
        <div className="overflow-x-auto rounded-lg border border-border bg-background p-4 motion-safe:animate-fade-in sm:p-6">
          <div className="flex items-start gap-4">
            {KANBAN_COLUMNS.map((col) => (
              <div key={col.stage} className="flex w-48 shrink-0 flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${col.badge}`}>
                    {col.stage}
                  </span>
                  <span className="text-xs text-muted-foreground">{col.students.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {col.students.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface p-2.5"
                    >
                      <Avatar name={name} className="h-7 w-7 shrink-0" />
                      <span className="truncate text-xs font-medium text-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DOCUMENTS */}
      <section id="documents" className="px-4 py-14 sm:px-8 lg:px-16 lg:py-20">
        <SectionHeading
          eyebrow="Documents & versioning"
          title="Chaque dépôt, horodaté et archivé"
          desc="Les étudiants déposent PDF, DOCX ou ODT par glisser-déposer ou en programmant l'envoi. Chaque version reste consultable — plus aucun fichier perdu dans un fil WhatsApp."
        />
        <div className="overflow-x-auto rounded-lg border border-border bg-surface motion-safe:animate-fade-in">
          <div className="min-w-[560px]">
            <div className="hidden items-center gap-4 border-b border-border bg-input px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:flex">
              <div className="flex-1">Fichier</div>
              <div className="w-32 shrink-0">Étudiant</div>
              <div className="w-24 shrink-0">Date</div>
              <div className="w-20 shrink-0">Taille</div>
            </div>
            {DOCUMENTS.map((d) => (
              <div
                key={d.name}
                className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
                    <Icon i="file-text" size={14} />
                  </div>
                  <span className="truncate text-sm font-medium text-foreground">{d.name}</span>
                </div>
                <div className="w-32 shrink-0 truncate text-xs text-muted-foreground">
                  {d.student}
                </div>
                <div className="w-24 shrink-0 text-xs text-muted-foreground">{d.date}</div>
                <div className="w-20 shrink-0 text-xs text-muted-foreground">{d.size}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENTAIRES */}
      <section
        id="commentaires"
        className="border-t border-border bg-surface px-4 py-14 sm:px-8 lg:px-16 lg:py-20"
      >
        <SectionHeading
          eyebrow="Commentaires contextuels"
          title="Des retours qui restent liés au bon chapitre"
          desc="Priorité, résolution, réponses — le fil de discussion reste attaché au document, pas perdu dans un email séparé."
        />
        <div className="flex flex-col gap-3 motion-safe:animate-fade-in">
          {COMMENTS.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <Avatar name={c.author} className="h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{c.author}</span>
                    {c.priority === 'high' && (
                      <span className="rounded-sm bg-danger/10 px-1.5 py-0.5 text-xs font-medium text-danger">
                        Priorité haute
                      </span>
                    )}
                    {c.resolved && (
                      <span className="rounded-sm bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
                        Résolu
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MESSAGERIE */}
      <section id="messagerie" className="px-4 py-14 sm:px-8 lg:px-16 lg:py-20">
        <SectionHeading
          eyebrow="Messagerie"
          title="Une conversation directe, avec pièces jointes"
          desc="Chaque thèse a son fil encadrant ↔ étudiant. Les images jointes s'ouvrent directement dans l'application, sans quitter la page."
        />
        <div className="mx-auto max-w-xl overflow-hidden rounded-lg border border-border bg-surface motion-safe:animate-fade-in">
          <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-3.5">
            <Avatar name="Fatou Sow" className="h-9 w-9" />
            <div>
              <div className="text-sm font-semibold text-foreground">Fatou Sow</div>
              <div className="text-xs text-muted-foreground">Étudiante — Rédaction</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 px-5 py-5">
            {MESSAGES.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.from === 'encadrant' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-md px-3.5 py-2.5 ${
                    m.from === 'encadrant'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-background text-foreground'
                  }`}
                >
                  <p className="text-sm">{m.text}</p>
                  {m.attachment && (
                    <div
                      className={`mt-2 flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs ${
                        m.from === 'encadrant' ? 'bg-primary-foreground/10' : 'bg-input'
                      }`}
                    >
                      <Icon i="paperclip" size={12} />
                      {m.attachment}
                    </div>
                  )}
                  <div
                    className={`mt-1 text-[10px] ${
                      m.from === 'encadrant'
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {m.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ÉCHÉANCES */}
      <section
        id="echeances"
        className="border-t border-border bg-surface px-4 py-14 sm:px-8 lg:px-16 lg:py-20"
      >
        <SectionHeading
          eyebrow="Échéances & rappels"
          title="Les retards se voient avant qu'il ne soit trop tard"
          desc="Chaque échéance est triée automatiquement — en retard, urgente, à venir, ou respectée dès que l'encadrant la valide. Des rappels groupés partent en un clic."
        />
        <div className="flex flex-col gap-6 motion-safe:animate-fade-in">
          {DEADLINE_SECTIONS.map((sec) => (
            <div key={sec.label}>
              <div className="mb-2 flex items-center gap-2">
                <Icon i={sec.icon} size={14} className={sec.tone} />
                <span className={`text-sm font-semibold font-headings ${sec.tone}`}>
                  {sec.label}
                </span>
                <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${sec.badge}`}>
                  {sec.items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {sec.items.map((it) => (
                  <div
                    key={it.title}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{it.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{it.student}</div>
                    </div>
                    <div className="shrink-0 text-xs font-medium text-muted-foreground">
                      {it.date}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ESPACE ÉTUDIANT */}
      <section id="etudiant" className="px-4 py-14 sm:px-8 lg:px-16 lg:py-20">
        <SectionHeading
          eyebrow="Espace étudiant"
          title="Le même niveau de clarté, côté étudiant"
          desc="Avancement, documents récents, encadrant et prochaine échéance — l'étudiant retrouve tout sur son propre tableau de bord, avec sa photo de profil et celle de son encadrant visibles des deux côtés."
        />
        <div className="grid grid-cols-1 gap-4 motion-safe:animate-fade-in lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
            <div className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Mon avancement
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-input">
                <div className="h-full bg-primary" style={{ width: '62%' }} />
              </div>
              <span className="text-sm font-semibold text-foreground">62%</span>
            </div>
            <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Documents récents
            </div>
            <div className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2">
              <Icon i="file-text" size={14} className="text-primary" />
              <span className="text-xs font-medium text-foreground">Chapitre_4_v3.pdf</span>
              <span className="ml-auto text-[10px] text-muted-foreground">Commenté</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Mon encadrant
            </div>
            <div className="flex items-center gap-3">
              <Avatar name="Pr. Koné Aboubakar" className="h-10 w-10" />
              <div>
                <div className="text-sm font-medium text-foreground">Pr. Koné Aboubakar</div>
                <div className="text-xs text-muted-foreground">Maître de conférences</div>
              </div>
            </div>
            <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Prochaine échéance
            </div>
            <div className="flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-2">
              <Icon i="calendar" size={12} className="text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                Dépôt chapitre 4 — 12 sept.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SÉCURITÉ */}
      <section
        id="securite"
        className="border-t border-border bg-surface px-4 py-14 sm:px-8 lg:px-16 lg:py-20"
      >
        <SectionHeading
          eyebrow="Sécurité & contrôle"
          title="L'encadrant garde la main, l'étudiant sait où il en est"
          desc="Un mémoire peut être mis en pause en cas de blocage administratif — l'étudiant est prévenu et ne peut plus agir tant que l'encadrant n'a pas levé le blocage. Toute action critique demande une confirmation explicite."
        />
        <div className="grid grid-cols-1 gap-4 motion-safe:animate-fade-in lg:grid-cols-2">
          <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger/5 p-4">
            <Icon i="alert-triangle" size={16} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <div className="text-sm font-medium text-danger">Espace bloqué</div>
              <p className="mt-0.5 text-xs text-danger/80">
                Quand un encadrant met une thèse en pause, l&apos;étudiant ne peut plus déposer de
                document, envoyer de message ni commenter — jusqu&apos;à la levée du blocage.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                <Icon i="alert-triangle" size={16} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Bloquer ce mémoire ?</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Déconnexion, choix de rôle à l&apos;onboarding, blocage, retrait d&apos;un
                  étudiant — chaque action critique demande une confirmation explicite avant
                  d&apos;être exécutée.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-border px-4 py-16 text-center sm:px-8 lg:px-16 lg:py-24">
        <h2 className="mb-4 font-headings text-2xl font-semibold text-foreground sm:text-3xl lg:text-4xl">
          Prêt à essayer avec vos propres étudiants ?
        </h2>
        <p className="mx-auto mb-8 max-w-md text-sm text-muted-foreground sm:text-base">
          Créez votre compte encadrant gratuitement, sans carte bancaire.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground transition duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98]"
        >
          <Icon i="arrow-right" size={14} />
          Créer mon compte gratuitement
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
