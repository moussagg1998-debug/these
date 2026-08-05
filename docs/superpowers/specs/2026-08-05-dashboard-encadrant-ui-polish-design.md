# Dashboard Encadrant — fidélité Banani, nettoyage, animations, responsive — design

Date : 2026-08-05
Statut : approuvé par l'utilisateur, prêt pour le plan d'implémentation

## Contexte

Le dashboard Encadrant (`frontend/src/app/dashboard/page.tsx`, Phase 3) et les
6 autres pages Encadrant (students, students/[id], documents, comments,
deadlines, messages, settings) reproduisent déjà la structure du mockup
Banani `DashboardEncadrant.jsx` (Sidebar + KPI cards + tableau + panneau
d'activité), et les tokens Tailwind (`frontend/src/app/globals.css`)
correspondent déjà exactement à `style.css` de Banani (`#1B4332`, `#F5F3EE`,
IBM Plex Sans…). Il n'y a donc **pas** de re-thématisation à faire — le
travail porte sur la fidélité structurelle, la suppression d'une mention
non pertinente, un bug de navigation, et une passe d'animations/responsive
sur toute l'application.

Chantier précédent pertinent : `2026-08-05-student-dashboard-pages-design.md`
a sciemment exclu d'ajouter une cloche de notifications côté Encadrant
("ce chantier ne l'ajoute pas"). Ce chantier-ci lève cette exclusion.

## Décisions confirmées avec l'utilisateur

1. **Périmètre de la refonte visuelle (point 1)** : les 7 pages Encadrant
   (dashboard, students, students/[id], documents, comments, deadlines,
   messages, settings), pas seulement `/dashboard`.
2. **Périmètre de la suppression "Année d'études" (point 2)** : partout où
   la mention apparaît — Encadrant (6 pages), Dashboard Étudiant, page
   d'accueil marketing.
3. **Périmètre animations (point 4)** : toute l'application (Encadrant +
   Étudiant + pages publiques : accueil, login, signup, etc.).
4. **Périmètre responsive (point 5)** : toute l'application, même périmètre
   que les animations.
5. **Approche technique animations** : Tailwind/CSS pur (pas de nouvelle
   dépendance type Framer Motion) — voir § Animations.

## 1. Refonte visuelle — fidélité Banani

### Écarts identifiés vs `DashboardEncadrant.jsx`

- **Pas de cloche de notifications côté Encadrant.** `NotificationBell.tsx`
  (`components/student/`) est déjà générique (aucune logique student-only,
  consomme `GET/PATCH /api/notifications*`) et déjà monté dans
  `StudentNav.tsx`. Les encadrants reçoivent déjà des notifications
  (`DOCUMENT_SUBMITTED`, `COMMENT_ADDED`, etc. — cf.
  `notifications/templates.ts`) sans aucune UI pour les consulter.
- **Pas de barre de recherche** dans le header (le mockup affiche
  "Rechercher un étudiant…").
- **Pas de filtre "Filtrer par étape"** à côté du bouton "Ajouter un
  étudiant" sur le dashboard (existe déjà comme composant `FilterBar` sur
  `/students`, juste pas branché sur le dashboard).
- **Pas de bouton "Envoyer des rappels groupés"** en bas du panneau
  d'activité (mockup : `mt-auto`, envoie un rappel groupé — voir § Hors
  périmètre, ce bouton reste décoratif).
- **Header dupliqué verbatim sur 6 pages** (`"Encadrement · Année
  2024–2025"` + `"Bonjour, {name}"` + variantes) — dans
  `dashboard/page.tsx`, `students/page.tsx`, `students/[id]/page.tsx`,
  `documents/page.tsx`, `comments/page.tsx`, `deadlines/page.tsx`.

### `DashboardHeader.tsx` (nouveau, `components/dashboard/`)

Extraction du bloc d'en-tête dupliqué, sur le même principe que
`DashboardShell` (règle de trois déjà appliquée ailleurs dans ce projet :
`AuthBrandingPanel`, `SettingSection`).

```ts
interface DashboardHeaderProps {
  eyebrow: string; // ex. "Encadrement", "Mes étudiants" — sans la mention d'année
  title: string; // ex. "Bonjour, Pr. Diallo"
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  actions?: ReactNode; // slot pour boutons spécifiques à la page (ex. filtre + "Ajouter")
}
```

- Rend l'eyebrow + titre à gauche, `<NotificationBell />` toujours à
  droite, une barre de recherche optionnelle entre les deux si `search`
  est fourni.
- `NotificationBell` : import direct depuis `components/student/` (pas de
  déplacement de fichier — aucune logique student-only à l'intérieur, le
  déplacer casserait un import déjà en place côté étudiant pour un gain nul).
- Chaque page passe son propre `eyebrow`/`title`/`actions` ; `search` n'est
  fourni que sur `/dashboard` et `/students` (les pages où une liste
  d'étudiants est affichée).

| Page | `eyebrow` | `title` |
|---|---|---|
| `/dashboard` | `"Encadrement"` | `"Bonjour, {name}"` |
| `/students` | `"Encadrement"` | `"Mes étudiants"` |
| `/students/[id]` | `"Encadrement"` | nom de l'étudiant |
| `/documents` | `"Encadrement"` | `"Documents"` |
| `/comments` | `"Encadrement"` | `"Commentaires"` |
| `/deadlines` | `"Encadrement"` | `"Échéances"` |

(titres non listés = valeur déjà affichée aujourd'hui sur chaque page,
inchangée — seule la mention d'année disparaît).

### Recherche — réelle, filtrage client

Le dashboard et `/students` chargent déjà la liste complète des thèses
via `/api/theses` (≤ 200 items, pas de pagination serveur par nom). La
recherche filtre donc **côté client** sur `thesis.student.name` /
`thesis.student.email` / `thesis.topic`, sans nouvel appel API — cohérent
avec le principe déjà appliqué dans ce projet (Phase 14 : transformer du
décoratif en réel plutôt que laisser une UI morte).

### Filtre par étape sur le dashboard

Réutilisation de `FilterBar`/`STAGE_FILTERS` (déjà utilisés sur
`/students`) au-dessus du tableau "Mes thèses & mémoires" du dashboard.

## 2. Suppression de "Année 2024–2025"

Occurrences à retirer :

| Fichier | Contexte |
|---|---|
| `dashboard/page.tsx` | header (absorbé par `DashboardHeader`) |
| `students/page.tsx` | idem |
| `students/[id]/page.tsx` | idem |
| `documents/page.tsx` | idem |
| `comments/page.tsx` | idem |
| `deadlines/page.tsx` | idem |
| `components/student/StudentDashboardContent.tsx:139` | ligne `"Année 2024–2025"` isolée |
| `app/page.tsx:114,175` | stats marketing (`sub: 'Année 2024-2025'`) + bandeau témoignages |

Sur les pages Encadrant, l'eyebrow devient simplement le libellé de
section (ex. `"Encadrement"`, `"Mes étudiants"`) sans le suffixe année.
Sur `StudentDashboardContent.tsx` et `page.tsx`, la mention est retirée
sans remplacement (pas de texte de substitution demandé).

## 3. Bug de surbrillance nav ("Mes étudiants" reste actif)

Lecture de `Sidebar.tsx`/`DashboardShell.tsx` : la logique
`pathname === item.href || pathname?.startsWith(\`${item.href}/\`)` est
correcte sur le papier, et `git diff` ne montre aucune modification locale
sur ces fichiers (le contenu correspond à HEAD). Donc pas de correctif
"évident" à appliquer aveuglément.

**Approche (systematic-debugging)** : avant tout correctif, reproduire en
conditions réelles — lancer `pnpm dev`, naviguer Dashboard → Étudiants →
Documents → Commentaires → Échéances → Messages → Paramètres avec un vrai
compte Encadrant, observer l'état de surbrillance à chaque étape (desktop
sidebar **et** drawer mobile, les deux ont une copie de cette logique).
Si le bug se reproduit, instrumenter (`console.log(pathname)` temporaire)
pour capturer la valeur réelle de `usePathname()` au moment du bug plutôt
que de deviner. Root cause et correctif documentés dans le plan
d'implémentation une fois reproduits.

## 4. Animations & micro-interactions — toute l'application

**Approche : Tailwind/CSS pur, aucune nouvelle dépendance.**

- **Hover/interactions** : `transition-colors duration-150`,
  `hover:scale-[1.02]` / `active:scale-[0.98]` sur boutons, cartes
  cliquables (`StudentRow`, `StatCard`, `DeadlineCard`, `DocumentRow`,
  liens de nav), `hover:shadow-md` sur les cartes.
- **Keyframes custom** ajoutés à `globals.css` (`@theme` / `@keyframes`
  Tailwind v4) : `fade-in`, `slide-up`, `scale-in` — appliqués via classes
  utilitaires (`animate-fade-in`, etc.) sur :
  - Ouverture de modales (`AddStudentForm`, `AddDeadlineForm`,
    `AddToCalendarModal`, `PasswordSettingsModal`) : fade du backdrop +
    scale-in du panneau.
  - Dropdowns (`NotificationBell`, menus) : fade + slide-up léger.
  - Drawer mobile (`DashboardShell`, `StudentNav` mobile) : transition
    `translate-x` déjà partiellement présente, uniformisée.
- **Respect de `prefers-reduced-motion`** : `@media (prefers-reduced-motion:
  reduce)` désactive/raccourcit les animations non essentielles (garde les
  transitions de couleur instantanées, retire les scale/slide).
- **Pas de changement de page animé** (pas de transition de route globale
  type View Transitions API — hors périmètre, cf. ci-dessous) ; "transitions
  fluides entre les états" se limite aux transitions d'éléments internes
  (loading → contenu, ouverture/fermeture) déjà couvertes ci-dessus.

## 5. Responsive — toute l'application

Audit + correctifs à 375/768/1280px sur l'ensemble des pages (Encadrant,
Étudiant, publiques), avec vérification réelle en navigateur (pas
uniquement un audit de code — le projet a déjà eu ce caveat sur plusieurs
phases précédentes). Méthode alignée sur celle de la Phase 12 du même
projet (`pnpm dev` + Playwright sur Chrome existant, check automatisé
`scrollWidth` vs `clientWidth`).

## 6. QA finale

- `pnpm format && pnpm lint && pnpm typecheck && pnpm test` — doivent tous
  passer (694+ tests existants ne doivent pas régresser).
- Vérification navigateur réelle du parcours complet Encadrant (dashboard,
  ajout étudiant, fiche étudiant, documents, commentaires, échéances,
  messages, paramètres) et Étudiant (dashboard, documents, commentaires,
  calendrier, messages) à 375/768/1280px.
- Confirmation que le bug de nav ne se reproduit plus sur les 7 pages
  Encadrant, desktop et mobile.
- Confirmation qu'aucune mention "Année 2024–2025" ne subsiste (grep de
  contrôle).

## Hors périmètre (explicitement exclu)

- Re-thématisation des couleurs/polices (déjà alignées sur Banani).
- Bouton "Envoyer des rappels groupés" reste **décoratif** (`disabled`,
  `title="Bientôt disponible"`, même pattern que "Plus d'options" sur
  `StudentProfileSidebar`) — aucun mécanisme de rappel groupé n'existe côté
  serveur, en créer un est hors périmètre de ce chantier UI.
- Pas de transition de route animée globale (View Transitions API) — les
  animations restent scoped aux éléments (cartes, modales, dropdowns), pas
  au changement de page lui-même.
- Pas de nouvelle dépendance (Framer Motion ou équivalent).
- Pas de déplacement de fichier pour `NotificationBell.tsx` (reste dans
  `components/student/`, importé tel quel côté Encadrant).
- Pas de nouvelle route API pour la recherche (filtrage 100% client sur les
  données déjà chargées).

## Ordre d'implémentation proposé (phases)

1. `DashboardHeader` (extraction + suppression Année + cloche + recherche)
   + branchement sur les 6 pages Encadrant.
2. Reste de la fidélité Banani dashboard (filtre par étape, bouton rappels
   décoratif).
3. Suppression "Année 2024–2025" restante (StudentDashboardContent,
   page.tsx marketing).
4. Reproduction + correction du bug de nav.
5. Animations & micro-interactions (toute l'app).
6. Audit + correctifs responsive (toute l'app).
7. QA finale (commandes + vérification navigateur réelle).
