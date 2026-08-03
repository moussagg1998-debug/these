# ThèseFacile — plan d'implémentation (Banani → izikit)

Source Banani : flow "ThèseFacile" (`YQWElzV_9JrI`), 19 écrans, récupérés le 2026-08-03.

## 0. Ce que révèle Banani

**Produit** : plateforme de suivi de mémoires/thèses universitaires à deux rôles :
- **Encadrant** (professeur superviseur) : tableau de bord, liste des étudiants suivis, fiche étudiant, bibliothèque de documents, commentaires sur les chapitres, calendrier d'échéances.
- **Étudiant** : tableau de bord perso, dépôt de fichiers, messagerie avec son encadrant.

Contexte académique ouest-africain (UCAD Dakar, sujets en français, noms/prénoms sénégalais/ivoiriens/maliens/camerounais) — donc produit localisé FR, pas de conversion i18n à prévoir.

**Design tokens** (`/style.css`, Tailwind v4 `@theme`) :

| Token | Valeur | Usage |
|---|---|---|
| `--color-background` | `#F5F3EE` | fond général (beige clair) |
| `--color-primary` | `#1B4332` | vert forêt — sidebar, CTA primaires |
| `--color-secondary` | `#D8F3DC` | vert menthe clair |
| `--color-accent` | `#C9782A` | terracotta — logo, badges d'accent |
| `--color-surface` | `#FFFFFF` | cartes/panneaux |
| `--color-warning` / `--color-danger` / `--color-success` | `#F5A623` / `#C0392B` / `#2E7D52` | états échéances/urgence |
| Police | `IBM Plex Sans` (body + headings) | |
| Rayons | sm 3px / md 6px / lg 10px / xl 16px | plutôt anguleux, peu arrondi |

Ce n'est **pas** la palette Tailwind par défaut du starter (`teal`/`amber` mentionnés dans les skills génériques) — il faudra étendre `globals.css` avec ce `@theme` exact plutôt que d'utiliser des classes Tailwind stock.

**Composants partagés Banani** (à recréer dans `frontend/src/components/`) :
`Sidebar`, `StatCard`, `StudentRow`, `ActivityItem`, `AddStudentForm`, `FilterBar`, `AddDeadlineForm`, `SettingSection`, `DeadlineCard`, `CommentThread`, `SuccessMessage`, `StudentProfileSidebar` + `Icon` (lucide-react) + `UserAvatar` (généré, à remplacer par de vrais avatars ou initiales).

## 1. Comparaison avec le starter izikit existant

| Brique du starter | Statut pour ThèseFacile |
|---|---|
| Auth (signup/login/verify-email/forgot-password/refresh/logout, cookies httpOnly, CSRF) | **Réutilisable tel quel** — c'est le socle de "Connexion" / "Choix du profil" |
| Google OAuth | **Réutilisable** — probable pour connexion via email universitaire |
| `User.role` (USER/ADMIN/SUPERADMIN) | **Garder tel quel** pour un futur back-office (support UCAD), mais **insuffisant seul** — il faut un rôle métier séparé (voir §2) |
| Admin back-office (`/api/admin/*`, audit log) | **Optionnel / à confirmer** — utile seulement si on veut un rôle "administration" qui supervise plusieurs encadrants |
| Notifications (`createNotification`, prefs, outbox) | **Réutilisable directement** — rappels d'échéance, nouveau commentaire, nouveau message, étudiant ajouté |
| Upload (Cloudinary + magic-byte sniff) | **Réutilisable directement** — dépôt de fichiers étudiant, bibliothèque de documents |
| Cron (outbox-drain, email-queue-drain, verification-cleanup) | **Réutilisable sans changement** |
| `/settings` (déjà construit, commit `fe35996`) | **Base à étendre** pour "Paramètres — Compte & Préférences" et "Paramètres Utilisateur" |
| **Orders** + `order-expiration` cron | **Réutilisé** — représentera l'achat d'un abonnement établissement (voir §2bis) |
| **Bictorys** (paiements mobile money) + `pay-redirect` + webhook | **Réutilisé** — encaissement de l'abonnement établissement |
| **Withdrawals** (PIN, advisory-lock, guards) | **Conservé mais inutilisé pour l'instant** — ce module sert à un *utilisateur* qui retire de l'argent (mobile money out) ; aucun flux identifié aujourd'hui où un encadrant/étudiant retire des fonds. On ne construit rien dessus tant qu'un besoin réel n'apparaît pas (ex: reversement à des encadrants vacataires) |

Décision utilisateur : **monétisation par abonnement établissement confirmée** — Orders/Bictorys sont donc dans le scope produit, pas à pruner.

## 2. Modèle de données à ajouter (`frontend/prisma/schema.prisma`)

Sans renommer les modèles génériques existants, ajouter :

```prisma
model User {
  // ... champs existants inchangés ...
  profileType String? // "ENCADRANT" | "ETUDIANT" — null tant que non choisi (post Choix du profil)
  institution String? // ex: "UCAD — Dakar"
  thesesAsStudent   Thesis[] @relation("ThesisStudent")
  thesesAsEncadrant Thesis[] @relation("ThesisEncadrant")
}

model Thesis {
  id           String   @id @default(cuid())
  topic        String
  stage        String   // "En attente" | "Rédaction" | "Révision" | "Bloqué" | "Soutenance"
  progress     Int      @default(0) // 0-100
  studentId    String
  student      User     @relation("ThesisStudent", fields: [studentId], references: [id])
  encadrantId  String
  encadrant    User     @relation("ThesisEncadrant", fields: [encadrantId], references: [id])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  documents Document[]
  comments  Comment[]
  deadlines Deadline[]
  messages  Message[]
}

model Document {
  id         String   @id @default(cuid())
  thesisId   String
  thesis     Thesis   @relation(fields: [thesisId], references: [id])
  chapter    String?  // ex: "Chapitre 3"
  fileUrl    String   // Cloudinary URL (via FileUpload existant)
  uploadedAt DateTime @default(now())
}

model Comment {
  id         String    @id @default(cuid())
  thesisId   String
  thesis     Thesis    @relation(fields: [thesisId], references: [id])
  documentId String?
  authorId   String
  author     User      @relation(fields: [authorId], references: [id])
  parentId   String?   // thread — réponse à un commentaire
  parent     Comment?  @relation("CommentThread", fields: [parentId], references: [id])
  replies    Comment[] @relation("CommentThread")
  body       String
  createdAt  DateTime  @default(now())
}

model Deadline {
  id        String   @id @default(cuid())
  thesisId  String
  thesis    Thesis   @relation(fields: [thesisId], references: [id])
  title     String
  dueAt     DateTime
  urgency   String   @default("medium") // "low" | "medium" | "high"
  createdAt DateTime @default(now())
}

model Message {
  id         String   @id @default(cuid())
  thesisId   String
  thesis     Thesis   @relation(fields: [thesisId], references: [id])
  senderId   String
  sender     User     @relation(fields: [senderId], references: [id])
  body       String
  createdAt  DateTime @default(now())
}
```

`Document` réutilise le système d'upload existant (`FileUpload` + Cloudinary) — `fileUrl` pointe vers le résultat de `/api/upload`, pas de nouvelle logique de stockage à écrire.

## 2bis. Abonnement établissement (monétisation confirmée)

Pas encore assez d'information pour figer le schéma exact (prix, granularité par établissement vs par encadrant, essai gratuit…) — à trancher en Phase 8, mais l'intention change dès maintenant la lecture d'`Order` :

```prisma
model Institution {
  id         String   @id @default(cuid())
  name       String   // ex: "UCAD — Dakar"
  encadrants User[]   // via User.institutionId
  orders     Order[]
}

model User {
  // ... + profileType, institution existants ...
  institutionId String?
  institutionRef Institution? @relation(fields: [institutionId], references: [id])
}

model Order {
  // ... champs génériques existants (montant en FCFA, entier) ...
  institutionId String? // abonnement établissement plutôt qu'achat e-commerce classique
}
```

`Withdrawal` reste tel quel dans le code (protégé, ne pas toucher) mais n'a pas de point d'entrée produit pour l'instant — on ne construit pas d'écran dessus tant qu'aucun flux de reversement n'est confirmé.

**Ne bloque pas les Phases 1-7** (le cœur produit fonctionne sans facturation) — à détailler quand on y arrive.

## 3. Routes API à ajouter (`frontend/src/app/api/`)

Toutes suivent le patron existant (`requireAuth` + `verifyCsrf` sur mutation + `withRequestContext` + `runtime = 'nodejs'`) :

- `POST /api/theses` — encadrant crée une thèse pour un étudiant (= "Ajouter un étudiant")
- `GET /api/theses` — liste mine (encadrant: ses étudiants ; étudiant: sa propre thèse)
- `GET /api/theses/[id]` — détail (= "Détail Étudiant — Profil")
- `PATCH /api/theses/[id]` — changer stage/progress
- `POST /api/theses/[id]/documents` — enregistrer un document après upload Cloudinary
- `GET /api/theses/[id]/documents` — bibliothèque de documents
- `POST /api/theses/[id]/comments` — ajouter un commentaire (avec `parentId` optionnel pour thread)
- `GET /api/theses/[id]/comments` — vue d'ensemble des commentaires
- `POST /api/theses/[id]/deadlines` / `GET .../deadlines` — échéances
- `POST /api/theses/[id]/messages` / `GET .../messages` — messagerie
- `PATCH /api/auth/me` (existe déjà probablement à étendre, sinon nouvelle route) — set `profileType` + `institution` lors du "Choix du profil"

## 4. Mapping écran Banani → route + composants

| Écran Banani | Route Next.js | Composants neufs | Composants réutilisés (starter) |
|---|---|---|---|
| Landing Page | `/` (remplace le `return null` actuel) | Hero, sections marketing | — |
| Connexion | `/login` | — | formulaire du starter (`examples/frontend-pages/login.tsx` comme base) |
| Choix du profil | `/onboarding/profile` | ProfileChoiceCard | — |
| Conditions d'utilisation | `/terms` | — | — |
| Dashboard Encadrant | `/dashboard` (encadrant) | `Sidebar`, `StatCard`, `StudentRow`, `ActivityItem` | `AuthProvider`, `api()` |
| Mes étudiants — Liste | `/students` | `FilterBar`, `StudentRow` | |
| Ajouter un étudiant | modal sur `/students` | `AddStudentForm` | |
| Étudiant ajouté | état de `/students` ou `/dashboard` | `SuccessMessage` | |
| Détail Étudiant | `/students/[id]` | `StudentProfileSidebar` | |
| Bibliothèque de documents | `/students/[id]/documents` | — | route `/api/upload` existante |
| Commentaires — Vue d'ensemble | `/students/[id]/comments` | `CommentThread` | |
| Échéances — Calendrier | `/deadlines` | `DeadlineCard` | |
| Ajouter une échéance | modal sur `/deadlines` | `AddDeadlineForm` | |
| Paramètres (encadrant) | `/settings` (étendre l'existant) | `SettingSection` | page `/settings` déjà montée |
| Dashboard Étudiant | `/student/dashboard` | — | |
| Dépôt de fichier étudiant | `/student/upload` | — | `/api/upload` existant |
| Messagerie étudiant-encadrant | `/student/messages` ou `/theses/[id]/messages` | thread de messages | |
| Ajout au calendrier — Modal | modal sur messagerie/deadlines | — | copie mentionne sync Google/Outlook — **décoratif au MVP** sauf confirmation |
| Paramètres Utilisateur (étudiant) | `/student/settings` | | même base que `/settings` |

## 5. Ordre de construction proposé

1. **Fondations** : tokens Tailwind (`@theme` ci-dessus dans `globals.css`), `Icon`/`UserAvatar` wrappers, migration Prisma (§2), routes `/api/theses*` (§3).
2. **Auth/onboarding** : Landing Page, Connexion (branché sur l'auth existante), Choix du profil (écrit `profileType`), Conditions d'utilisation.
3. **Encadrant — cœur** : Dashboard Encadrant, Mes étudiants (liste + filtre), Ajouter un étudiant (+ état "ajouté"), Détail Étudiant.
4. **Documents & commentaires** : Bibliothèque de documents (upload), Commentaires vue d'ensemble (threads).
5. **Échéances** : Calendrier, Ajouter une échéance, modal "Ajout au calendrier".
6. **Étudiant** : Dashboard Étudiant, Dépôt de fichier, Messagerie.
7. **Paramètres** des deux côtés.

Chaque écran suit le workflow standard du skill `banani-design-implementation` (fetch ciblé par `screenIds`, plan écran, implémentation mobile-first, vérif 375/768/1280px, commit atomique).

## 6. Décisions confirmées (2026-08-03)

1. **Rôle applicatif** : `profileType` (ENCADRANT/ETUDIANT) en champ `User` séparé du `role` admin (USER/ADMIN/SUPERADMIN). ✅
2. **Cardinalité** : 1 encadrant → N étudiants, 1 thèse active par étudiant. Pas de co-encadrement, pas d'historique multi-thèses au MVP. ✅
3. **Monétisation** : abonnement établissement confirmé — Orders + Bictorys **conservés et utilisés** (voir §2bis). Withdrawals conservé dans le code mais sans écran/flux au MVP. ✅
4. **Back-office admin** : conservé pour un futur rôle "administration université" (support multi-encadrants). ✅
5. **Messagerie** : refetch périodique au MVP, pas d'Ably pour l'instant (à reconsidérer si le besoin de vrai temps réel se confirme). ✅
6. **Sync calendrier externe** : décoratif au MVP — le bouton "synchroniser" ne fait rien de réel, l'événement reste interne (Deadline/Meeting). ✅
7. **Choix du profil** : fixe à l'inscription, un compte = un rôle. ✅

Ces décisions déverrouillent la Phase 1 (fondations) — plus d'hypothèses bloquantes.
