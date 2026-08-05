# Pages étudiant (Documents/Commentaires/Calendrier) + dropdown de notifications — design

Date : 2026-08-05
Statut : approuvé par l'utilisateur, prêt pour le plan d'implémentation

## Contexte

Le nav étudiant (`StudentNav.tsx`) affiche 4 liens : "Mon mémoire" (réel, →
`/dashboard`) et 3 liens inertes — "Documents", "Commentaires", "Calendrier"
— rendus en `<span>` avec `title="Bientôt disponible"`, sans `href` ni
`onClick`. C'est un choix documenté (Phase 7-9, voir
`.planning/banani/phase-7-dashboard-etudiant.md` ligne 39 : "4 nav items —
1 real link + 3 inert"), pas un bug. La cloche de notification à côté est
elle aussi purement décorative : elle affiche le badge de compteur réel
(`GET /api/notifications/count`) mais n'a ni `onClick` ni dropdown.

L'objectif : rendre ces 3 pages et la cloche réellement fonctionnelles.

## Ce qui existe déjà (aucun changement requis côté backend)

- `GET/POST /api/theses/[id]/documents`, `GET/POST /api/theses/[id]/comments`,
  `GET /api/theses/[id]/deadlines` (POST est `ENCADRANT_ONLY`) — tous déjà
  accessibles par le student ou l'encadrant de la thèse via
  `resolveThesisAccess` (pas de restriction par `profileType`).
- `GET/PATCH /api/notifications` (`frontend/src/app/api/notifications/route.ts`)
  — liste paginée par curseur (`items`, `nextCursor`), filtre `unread`, et
  `PATCH { ids: string[] | 'all' }` qui marque comme lu et retourne
  `{ updated, unreadCount }`. Générique par `userId`, déjà testé, jamais
  consommé par aucune UI avant ce chantier.
- Composants réutilisables tels quels : `StudentDocumentRow.tsx`,
  `StudentCommentItem.tsx`, `AddToCalendarModal.tsx`, `lib/ics.ts`.
- `/documents`, `/comments`, `/deadlines` existent déjà comme pages
  **encadrant** (agrégées, multi-thèses) et redirigent aujourd'hui tout
  `profileType === 'ETUDIANT'` vers `/dashboard` — même point d'entrée que
  `/students` et l'ancien `/dashboard` avant qu'il ne branche sur
  `StudentDashboardContent`.
- Le seul autre endroit où l'icône cloche existe dans le code est
  `StudentNav.tsx` — `DashboardShell.tsx` (nav encadrant) n'en a pas. Donc
  "toutes les pages qui la contiennent" = les 4 pages qui rendent déjà
  `<StudentNav>` : `StudentDashboardContent`, `StudentMessagingContent`,
  `StudentFileUploadForm` (`/documents/new`), plus les 3 nouvelles pages de
  ce chantier (qui rendront aussi `<StudentNav>`).

## Décisions confirmées avec l'utilisateur

1. **Routing** : réutilisation des URLs `/documents`, `/comments`,
   `/deadlines` existantes — chaque `page.tsx` branche sur
   `profile.profileType === 'ETUDIANT'` (remplace le `router.replace('/dashboard')`
   actuel) et rend un nouveau composant `Student*Content`, exactement le
   même schéma que `/dashboard` aujourd'hui. Pas de nouvelle route API.
2. **Commentaires — lecture + réponse** : la page affiche le fil complet
   (encadrant ET étudiant, pas seulement les commentaires de l'encadrant
   comme le fait le dashboard aujourd'hui) et ajoute un composeur pour que
   l'étudiant réponde — l'API le permet déjà (`POST` n'a pas de restriction
   de rôle), seule l'UI manquait. Fil plat, pas de `parentId`/threading
   imbriqué (même niveau de simplicité que la messagerie existante).
3. **Calendrier — lecture seule** : liste groupée par urgence (même
   découpage que la page encadrant : En retard/Urgent/À venir), bouton
   "Ajouter au calendrier" par échéance (ouvre `AddToCalendarModal`,
   inchangé). Pas de création — confirmé `ENCADRANT_ONLY` côté serveur,
   décision déjà actée, pas de formulaire à construire.
4. **Notification au clic : marquer lu + naviguer.** Voir mapping ci-dessous.

## Design

### Pages étudiant

Chaque page suit le même squelette que `StudentDashboardContent.tsx` :
`'use client'`, résout `profile` + la thèse unique de l'étudiant
(`GET /api/theses` → `items[0]`), affiche `<StudentNav name={name} />`,
gère les 3 états (chargement / pas de thèse assignée / contenu).

**`StudentDocumentsContent.tsx`** (nouveau, `components/student/`)
- Fetch `GET /api/theses/{id}/documents` + `GET /api/theses/{id}/comments`
  (pour dériver `commented`, même logique que
  `StudentDashboardContent`'s `commentedDocIds`).
- Liste complète (pas de `.slice`) via `StudentDocumentRow`, réutilisé tel
  quel. Bouton "Déposer un fichier" → `/documents/new` (déjà existant),
  même position que sur le dashboard.
- État vide : "Aucun document déposé pour l'instant." (déjà le texte du
  dashboard, réutilisé).

**`StudentCommentsContent.tsx`** (nouveau, `components/student/`)
- Fetch `GET /api/theses/{id}/comments` → **tous** les items (pas de
  filtre par auteur, contrairement au dashboard).
- Liste via `StudentCommentItem` réutilisé tel quel (déjà agnostique de
  l'auteur — affiche `comment.author` quel qu'il soit ; son bouton
  "Marquer résolu" reste `disabled` pour tout le monde côté étudiant, pas
  de changement).
- Composeur en bas de page, même pattern que
  `StudentProfileSidebar.tsx`'s "Envoyer un retour" : `useState` pour
  `body`/`sending`, `POST /api/theses/{id}/comments` avec `{ body }`,
  toast succès/erreur, `refresh()` de la liste de commentaires après envoi
  (pas de `refresh()` global de la thèse — le composeur ne touche que les
  commentaires).
- État vide : "Aucun commentaire pour l'instant."

**`StudentCalendarContent.tsx`** (nouveau, `components/student/`)
- Fetch `GET /api/theses/{id}/deadlines` → `items: ThesisDeadline[]`
  (forme plate, sans `thesis` imbriqué — contrairement à l'agrégat
  encadrant `DeadlineListItem`).
- Groupe par bucket via `deadlineUrgencyBucket` (déjà dans `lib/theses.ts`,
  inchangé) : sections "En retard" / "Urgent" / "À venir" — mêmes 3
  sections et mêmes classes de couleur que `/deadlines/page.tsx`
  (`headingClass`/`badgeClass`/`iconClass` par bucket), copiées telles
  quelles.
- **`StudentDeadlineCard.tsx`** (nouveau, `components/student/`) — `DeadlineCard`
  existant n'est pas réutilisable ici : il attend `deadline.thesis.student`
  et `deadline.thesis.stage` (forme agrégée) qui n'existent pas sur
  `ThesisDeadline`. Version simplifiée : titre, description, date,
  badge d'urgence (`daysUntil` + `deadlineUrgencyBucket`), bouton
  "Ajouter au calendrier" qui ouvre `AddToCalendarModal` avec cette
  échéance. Même précédent de simplification que `StudentDocumentRow` vs
  `DocumentRow`.
- État vide : "Aucune échéance à venir."

### `NotificationBell.tsx` (nouveau, `components/ui/`)

Composant autonome (aucune prop requise — résout son propre state), monté
dans `StudentNav.tsx` à la place du `<div>` décoratif actuel.

- **Badge** : garde le fetch existant de `GET /api/notifications/count`
  pour le nombre affiché sur la cloche (inchangé).
- **Ouverture** : `useState<boolean>` pour `open`. Clic sur la cloche
  bascule `open`. `useRef` + listener `mousedown` sur `document` pour
  fermeture au clic extérieur, plus `Escape` pour fermer — aucun pattern
  de dropdown existant dans le repo à réutiliser, ce composant établit la
  convention.
- **Contenu** : au premier `open === true`, fetch `GET /api/notifications?limit=10`
  (pas de pagination dans le dropdown — 10 dernières, pas de "voir plus").
  Chaque item : titre, corps, temps relatif (`relativeTime`, déjà dans
  `lib/theses.ts`), point non-lu si `readAt === null`.
- **Bouton "Tout marquer comme lu"** en en-tête du dropdown, visible si au
  moins un item non lu : `PATCH { ids: 'all' }`, puis rafraîchit la liste
  locale (tous `readAt` mis à maintenant) et le compteur du badge.
- **Clic sur une notification** :
  1. `PATCH { ids: [id] }` (best-effort, ne bloque pas la navigation si ça
     échoue — même posture "best-effort" que les autres notifications de
     l'app).
  2. Ferme le dropdown.
  3. Navigue selon `type` :

     | `type` | Destination |
     |---|---|
     | `COMMENT_ADDED` | `/comments` |
     | `DEADLINE_ADDED` | `/deadlines` |
     | `MESSAGE_RECEIVED` | `/messages` |
     | `THESIS_ASSIGNED` | `/dashboard` |
     | tout autre type (`DOCUMENT_SUBMITTED`, `WITHDRAWAL_REQUESTED`, futur) | pas de navigation — juste marqué lu, dropdown fermé |

     Pas besoin de lire `data.thesisId` pour construire l'URL — un
     étudiant n'a qu'une seule thèse, ces 4 pages sont déjà scopées à "la
     mienne" côté serveur.
- **État vide** : "Aucune notification."

### Câblage dans `StudentNav.tsx`

- Les 3 `<span>` inertes deviennent des `<Link>` vers `/documents`,
  `/comments`, `/deadlines`, avec le même style actif/inactif que "Mon
  mémoire" (`StudentNavProps.active` s'étend à
  `'dashboard' | 'documents' | 'comments' | 'deadlines'`, chaque page
  passe la bonne valeur).
- Le `<div>` cloche actuel est remplacé par `<NotificationBell />`.

## Hors périmètre (explicitement exclu)

- Pas de page "toutes les notifications" dédiée (au-delà des 10 dernières
  du dropdown) — non demandé.
- Pas de threading imbriqué (`parentId`) sur les commentaires étudiant.
- Pas de création d'échéance côté étudiant (déjà `ENCADRANT_ONLY`, décision
  actée).
- Pas de cloche ajoutée côté `DashboardShell` (encadrant) — elle n'existe
  pas aujourd'hui à cet endroit, ce chantier corrige ce qui existe déjà, il
  n'ajoute pas de nouvelle surface côté encadrant.
- Pas de push temps réel (Ably) pour les notifications ou les nouveaux
  commentaires — polling/refetch au montage et après action, même
  comportement que le reste de l'app (cf. décision similaire dans la spec
  stage-change).

## Tests

Aucun test de composant (convention du projet : zéro `.test.tsx`).
Vérification manuelle sur le dev server, avec un compte étudiant ayant une
thèse assignée :
- Naviguer vers `/documents`, `/comments`, `/deadlines` depuis le nav —
  confirmer que chaque page affiche le bon contenu au lieu de rediriger
  vers `/dashboard`.
- Déposer un commentaire depuis la nouvelle page Commentaires, confirmer
  qu'il apparaît dans le fil sans rechargement.
- Sur Calendrier, confirmer le regroupement par urgence et l'export .ics
  d'une échéance.
- Cliquer la cloche sur chacune des pages qui la contiennent, confirmer
  l'ouverture du dropdown, le clic-extérieur pour fermer, et la navigation
  au clic sur une notification de chaque type testable (au minimum
  `MESSAGE_RECEIVED` en s'envoyant un message).
