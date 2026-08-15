# Envoi de fichiers de l'encadrant vers l'étudiant — Design

**Date:** 2026-08-15
**Statut:** Approuvé

## Contexte

Aujourd'hui, le flux de documents sur une thèse (`Document`, lié à `Thesis`) est
strictement à sens unique : seul l'étudiant peut déposer un fichier
(`POST /api/theses/[id]/documents` renvoie `403 STUDENT_ONLY` sinon),
l'encadrant ne fait que consulter (`GET` sur la même route, et l'agrégat
inter-thèses `GET /api/documents`, "Bibliothèque de documents").

Besoin : l'encadrant doit pouvoir envoyer un fichier à l'étudiant. Usage
confirmé — **corrections/annotations sur un dépôt existant** (l'encadrant
répond à un chapitre précis déposé par l'étudiant), pas une bibliothèque de
ressources libres non liées à un dépôt.

## Décision de modélisation

Un seul champ nouveau sur `Document` : `replyToDocumentId` (self-relation
nullable). Pas de champ `authorId`/expéditeur séparé — l'expéditeur se déduit
de la présence de ce champ :

- `replyToDocumentId == null` → dépôt étudiant ordinaire (comportement
  actuel, inchangé). Toutes les lignes existantes sont déjà correctes sous
  cette règle : avant cette fonctionnalité, 100% des `Document` étaient créés
  par l'étudiant (`STUDENT_ONLY` l'imposait). **Aucun backfill nécessaire.**
- `replyToDocumentId != null` → correction envoyée par l'encadrant, qui
  répond au document ciblé.

Un document ne peut répondre qu'à un dépôt qui n'est pas lui-même une
réponse (pas de fil de discussion à plusieurs niveaux — une correction reste
directement rattachée au dépôt original).

## Schéma (`frontend/prisma/schema.prisma`)

```prisma
model Document {
  id                String     @id @default(cuid())
  thesisId          String
  thesis            Thesis     @relation(fields: [thesisId], references: [id], onDelete: Cascade)
  chapter           String?
  fileUrl           String
  fileName          String?
  sizeBytes         Int?
  uploadedAt        DateTime   @default(now())
  scheduledAt       DateTime?
  // Set uniquement sur une correction envoyée par l'encadrant — pointe vers
  // le dépôt étudiant auquel elle répond. Null = dépôt étudiant ordinaire.
  // C'est ce champ, et non un champ "auteur" séparé, qui distingue
  // l'expéditeur (voir design doc "Décision de modélisation").
  replyToDocumentId String?
  replyTo           Document?  @relation("DocumentReplies", fields: [replyToDocumentId], references: [id], onDelete: SetNull)
  replies           Document[] @relation("DocumentReplies")
  comments          Comment[]

  @@index([thesisId, uploadedAt])
  @@index([scheduledAt])
  @@index([replyToDocumentId])
}
```

`onDelete: SetNull` — même politique que `Comment.documentId` : si le dépôt
original venait à disparaître, la correction reste (fichier toujours valide),
elle perd juste son lien.

Migration triviale : ajout d'une colonne nullable + FK + index. Pas de
migration de données.

## API — `POST /api/theses/[id]/documents`

La route existe déjà et gère aujourd'hui uniquement le cas étudiant. Règles
étendues, selon qui appelle (`access.studentId` vs `access.encadrantId`,
comme le fait déjà `resolveThesisAccess`) :

### Appelant = étudiant (inchangé + 1 nouvelle garde)

- Comportement actuel intact (dépôt libre, `scheduledAt` optionnel, garde
  "Bloqué").
- **Nouveau** : si `replyToDocumentId` est présent dans le body →
  `400 VALIDATION_FAILED` ("Only the encadrant can reply to a document").
  Un étudiant ne répond jamais à un document — il dépose.

### Appelant = encadrant (nouveau)

- `replyToDocumentId` est **obligatoire**. Absent → `400 VALIDATION_FAILED`.
- Le document ciblé doit exister, appartenir à la même thèse, et ne pas être
  lui-même une réponse (`target.replyToDocumentId === null`). Toute
  violation → `400 INVALID_REPLY_TARGET`.
- `scheduledAt` n'est **pas** accepté pour un envoi encadrant → `400
  VALIDATION_FAILED` si présent. Pas de "programmer l'envoi" pour une
  correction (hors périmètre — usage confirmé = réponse à un dépôt existant,
  pas une bibliothèque de ressources).
- La garde "Bloqué" (403 `THESIS_BLOCKED`) **ne s'applique pas** à
  l'encadrant — c'est lui qui pose ce statut sur la thèse ; le lui appliquer
  à lui-même n'a pas de sens.
- Aucune limite sur le nombre de corrections par dépôt : l'encadrant peut
  envoyer plusieurs corrections successives qui pointent toutes vers le même
  `replyToDocumentId` (ex. l'étudiant renvoie une version révisée sous le
  même chapitre, l'encadrant recorrige).
- Succès → `201`, notification au studentId (voir plus bas).

### `GET` (per-thesis et agrégat `/api/documents`)

Aucun changement de logique. Les deux routes renvoient déjà tous les
`Document` de la thèse sans filtrer par expéditeur — une correction
apparaît donc automatiquement dans la même liste chronologique que les
dépôts étudiants, exactement le comportement demandé. Seul le type de
réponse gagne le champ `replyToDocumentId`.

## Notifications

Nouveau type `DOCUMENT_RECEIVED`, symétrique à `DOCUMENT_SUBMITTED`,
déclenché vers `access.studentId` quand l'encadrant envoie une correction.

`DOCUMENT_SUBMITTED` est aujourd'hui construit inline dans la route
(`createNotification(prisma, { type: 'DOCUMENT_SUBMITTED', ... })`) plutôt
que via un wrapper typé dans `notifications/templates.ts` — alors que
CLAUDE.md ("Files Claude SHOULD modify") demande explicitement d'ajouter les
notifications comme wrappers typés là-bas. Comme `DOCUMENT_RECEIVED` sera
ajouté juste à côté dans le même fichier, les deux sont ajoutés comme
wrappers typés dans `templates.ts` (`documentSubmitted(...)` et
`documentReceived(...)`), et l'appel inline existant est migré vers le
nouveau `documentSubmitted(...)` dans la foulée — petit alignement local,
pas une refonte.

```ts
// templates.ts
export function documentSubmitted(
  encadrantId: string,
  documentId: string,
  chapter: string | null,
): CreateNotificationInput {
  return {
    userId: encadrantId,
    type: 'DOCUMENT_SUBMITTED',
    title: 'Nouveau document déposé',
    body: chapter ? `Nouveau dépôt : ${chapter}` : 'Nouveau document déposé',
    data: { documentId },
    dedupeKey: `document-submitted:${documentId}`,
  };
}

export function documentReceived(
  studentId: string,
  documentId: string,
  chapter: string | null,
): CreateNotificationInput {
  return {
    userId: studentId,
    type: 'DOCUMENT_RECEIVED',
    title: 'Nouveau fichier de votre encadrant',
    body: chapter ? `Correction reçue : ${chapter}` : 'Votre encadrant vous a envoyé un fichier',
    data: { documentId },
    dedupeKey: `document-received:${documentId}`,
  };
}
```

`dedupeKey` déterministe par document, comme l'existant — livraison
au plus une fois. Best-effort (try/catch, ne bloque pas la création du
document), même traitement que l'appel actuel.

## UI

### `DocumentRow` (`components/dashboard/DocumentRow.tsx`)

Utilisé par la "Bibliothèque de documents" (`/documents`, agrégat
inter-thèses, encadrant uniquement) et référencé depuis l'onglet Documents
de la fiche étudiant (`/students/[id]` → lien vers `/documents?studentId=`).

- Nouvelle action "Envoyer une correction" (icône), visible seulement sur
  les lignes qui ne sont **pas** elles-mêmes une réponse
  (`doc.replyToDocumentId == null`) — on ne répond pas à une réponse.
- Ouvre `SendCorrectionModal` (nouveau composant), pré-lié à
  `replyToDocumentId = doc.id`.
- Une ligne qui est une correction (`doc.replyToDocumentId != null`) affiche
  un petit badge distinctif au lieu de l'action d'envoi.

### `SendCorrectionModal` (nouveau, `components/dashboard/`)

Même schéma que `StudentFileUploadForm` mais en modal (à l'image
d'`UpgradeModal`, déjà établi dans ce projet) plutôt qu'en page dédiée,
puisque l'action part toujours d'une ligne de document précise :

- Zone drag-drop, mêmes contraintes client (10 Mo, `.pdf/.docx/.odt` —
  identiques à l'upload étudiant, même route `/api/upload` /
  `UPLOAD_ALLOWED_MIME` côté serveur, rien de nouveau à ce niveau).
- Champ note optionnel → posté comme `Comment` lié au nouveau document
  (`POST /api/theses/[id]/comments`), même pattern que les "Notes" de
  `StudentFileUploadForm`.
- Pas de champ "programmer l'envoi" (hors périmètre, cf. plus haut).
- Soumission : `uploadFile()` → `POST /api/theses/[id]/documents` avec
  `{ fileUrl, fileName, sizeBytes, replyToDocumentId }`.

### `StudentDocumentRow` (`components/student/StudentDocumentRow.tsx`)

Le badge actuel ("Commenté" / "En attente de retour", dérivé de la présence
d'un `Comment`) n'a pas de sens pour une correction reçue — c'est déjà le
retour de l'encadrant. Pour `doc.replyToDocumentId != null` : badge
distinct "De votre encadrant" à la place du badge commenté/en attente.

### Regroupement visuel

Pas de nesting côté serveur (pas de `include: { replies: true }`) — la liste
reste plate, exactement le comportement approuvé, et ça évite de complexifier
la pagination par curseur de `GET /api/documents`. Le lien "↳ réponse à
[chapitre]" se fait côté client par une recherche dans la liste déjà chargée
(`items.find(d => d.id === doc.replyToDocumentId)`), pas une requête
supplémentaire.

## Erreurs

| Code | Cas |
|---|---|
| `VALIDATION_FAILED` | étudiant envoie `replyToDocumentId` ; encadrant omet `replyToDocumentId` ; encadrant envoie `scheduledAt` |
| `INVALID_REPLY_TARGET` | `replyToDocumentId` ne référence pas un document valide, non-réponse, de la même thèse |

`STUDENT_ONLY` (403) et `THESIS_BLOCKED` (403) restent inchangés et
continuent de ne s'appliquer qu'au chemin étudiant.

## Tests

`route.test.ts` (`/api/theses/[id]/documents`) étendu :

- Encadrant envoie une correction valide → 201, `replyToDocumentId`
  persisté, notification `DOCUMENT_RECEIVED` déclenchée vers l'étudiant.
- Encadrant omet `replyToDocumentId` → 400 `VALIDATION_FAILED`.
- Encadrant cible un document d'une autre thèse / inexistant / qui est déjà
  une réponse → 400 `INVALID_REPLY_TARGET`.
- Encadrant envoie `scheduledAt` → 400 `VALIDATION_FAILED`.
- Encadrant envoie une correction alors que la thèse est "Bloqué" → succès
  (garde non appliquée à l'encadrant).
- Étudiant envoie `replyToDocumentId` → 400 `VALIDATION_FAILED`.
- Étudiant dépose normalement → comportement inchangé (régression).

Pas d'infrastructure de test de composants dans ce repo — la partie UI
(`SendCorrectionModal`, badges) reste en QA manuelle, comme le reste du
projet.

## Hors périmètre

- Bibliothèque de ressources libres non liées à un dépôt (option écartée en
  clarification).
- "Programmer l'envoi" côté encadrant (symétrique de "Programmer le dépôt").
- Fils de discussion à plusieurs niveaux (réponse à une réponse).
- Champ expéditeur explicite en base (dérivé de `replyToDocumentId`, voir
  "Décision de modélisation").
