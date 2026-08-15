# Annotation de PDF par page, sans téléchargement préalable — Design

**Date:** 2026-08-15
**Statut:** Approuvé

## Contexte

Aujourd'hui, ouvrir un document depuis la liste (`DocumentRow` côté encadrant,
`StudentDocumentRow` côté étudiant) ne propose qu'un lien de téléchargement
(`<a href={doc.fileUrl} target="_blank">`). Corriger un document déposé par
l'étudiant suppose donc, pour l'encadrant, de d'abord le télécharger, le
corriger localement, puis renvoyer un nouveau fichier via le flux de
correction existant (`SendCorrectionModal`, `replyToDocumentId` — voir
`2026-08-15-encadrant-document-corrections-design.md`).

Besoin : pouvoir ouvrir un PDF directement dans le navigateur et y laisser un
commentaire rattaché à une page précise, sans étape de téléchargement
préalable. Ceci **s'ajoute** au flux existant d'envoi de fichier corrigé — ce
n'est pas un remplacement : l'encadrant garde les deux options (annoter en
place, ou renvoyer un fichier entièrement corrigé).

## Décisions de portée (clarifiées en amont)

- **Annotation = commentaire positionné, pas édition de contenu.** Le
  fichier original n'est jamais modifié. C'est une extension du système de
  `Comment` existant, pas un éditeur de document.
- **Précision de position : numéro de page uniquement**, pas de pin x/y.
  Permet d'utiliser le rendu PDF natif du navigateur (`<iframe>`) — aucune
  dépendance JS de rendu PDF (pdf.js/react-pdf) n'est nécessaire.
- **PDF uniquement.** Les dépôts `.docx`/`.odt` restent téléchargement
  seul, comme aujourd'hui — pas de rendu natif possible pour ces formats
  dans un navigateur, et pas de conversion à la volée dans cette itération.
- **La barre d'outils PDF native du navigateur garde son propre bouton de
  téléchargement/impression** — impossible à masquer sans passer par un
  rendu PDF.js personnalisé, explicitement écarté. Le flux n'exige jamais
  de cliquer dessus ; il reste simplement visible.
- **Accès aux deux rôles.** Le même visualiseur sert l'encadrant et
  l'étudiant sur leurs documents PDF respectifs — sinon l'étudiant ne peut
  pas savoir à quelle page un commentaire se rapporte. `Comment` n'a jamais
  été réservé à l'encadrant (les deux rôles peuvent déjà commenter
  aujourd'hui via `POST /api/theses/[id]/comments`).

## Schéma (`frontend/prisma/schema.prisma`)

Un seul champ ajouté à `Comment` :

```prisma
model Comment {
  // ...champs existants inchangés...
  // Numéro de page PDF auquel ce commentaire est rattaché. Uniquement sur
  // un commentaire de premier niveau (parentId: null) portant sur un
  // document (documentId non-null) — une réponse dans un fil n'a pas sa
  // propre page, elle hérite du contexte du commentaire racine. Null =
  // commentaire général sur le document (comportement actuel, inchangé).
  page       Int?
}
```

Migration versionnée requise (`pnpm db:migrate:dev`) — voir la leçon de la
review finale du plan précédent : ce dépôt maintient de vraies migrations,
`pnpm db:push` seul ne suffit pas pour un déploiement `migrate deploy`
propre.

## API

### `POST /api/theses/[id]/comments` (existant, étendu)

Nouveau champ optionnel dans le corps : `page: number` (entier positif).

Règles de validation ajoutées à côté des règles existantes (body/documentId/
parentId/priority inchangés) :

- `page` fourni sans `documentId` → `400 VALIDATION_FAILED` ("page requires
  documentId — a page number is meaningless without a document to anchor
  it to").
- `page` fourni avec `parentId` déjà présent (c'est une réponse dans un
  fil) → `400 VALIDATION_FAILED` ("replies inherit their thread's page,
  they cannot set their own").
- Sinon, comportement inchangé : `page` est simplement persisté sur le
  `Comment` créé.

### `GET /api/theses/[id]/comments` (existant, inchangé)

Renvoie déjà tous les commentaires de la thèse, `page` inclus une fois le
champ ajouté au schéma (pas de `select` explicite qui l'exclurait). Le
nouveau visualiseur filtre côté client sur `documentId === id` — pas de
nouveau paramètre de requête, pas de nouvelle route de lecture pour la
liste des commentaires. Le volume de commentaires par thèse reste modeste
(pas de pagination sur cette route aujourd'hui), donc ce filtrage
client-side est un choix délibérément simple (YAGNI) plutôt qu'un filtre
serveur.

### `GET /api/documents/[id]` (nouveau)

Nécessaire car la page du visualiseur (`/documents/[id]/view`) n'a que
l'id du document dans son URL, pas l'id de la thèse. Résout la thèse
propriétaire du document et applique la même garde d'accès que toutes les
routes documents/comments existantes.

```ts
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return NextResponse.json({ error: 'DOCUMENT_NOT_FOUND' }, { status: 404 });
  }
  const access = await resolveThesisAccess(prisma, document.thesisId, auth.user.sub);
  if (access instanceof NextResponse) return access;

  return NextResponse.json(document);
}
```

404 générique (`DOCUMENT_NOT_FOUND`) si le document n'existe pas OU si
l'appelant n'a pas accès à la thèse propriétaire — même posture
"ne pas révéler l'existence" que `resolveThesisAccess` applique déjà
partout ailleurs.

## UI

### `DocumentRow` (encadrant) et `StudentDocumentRow` (étudiant)

Nouvelle action "Ouvrir" (icône), visible **uniquement sur les lignes dont
le fichier est un PDF** — même dérivation d'extension que
`documentFormat()` (déjà utilisée pour l'affichage du format). Un dépôt
`.docx`/`.odt` ne montre pas cette action ; seul le téléchargement reste
disponible pour ces formats, comme aujourd'hui. Lien vers
`/documents/[id]/view`.

### `/documents/[id]/view` (nouvelle page)

Structure à deux zones :

- **Visualiseur PDF** : `<iframe src={doc.fileUrl}>` occupant la majorité de
  l'écran — rendu natif du navigateur, navigation/zoom/impression/
  téléchargement gérés par le navigateur lui-même (voir la décision de
  portée ci-dessus).
- **Panneau de commentaires**, filtré sur ce `documentId` :
  - Liste des commentaires existants (auteur, texte, temps relatif, badge
    "p. N" quand `page` est renseigné, fil de réponses existant réutilisé
    tel quel).
  - Formulaire d'ajout : champ texte + champ numéro de page optionnel
    (vide = commentaire général sur le document, comportement actuel).
    Soumission : `POST /api/theses/[id]/comments` avec
    `{ body, documentId, ...(page ? { page } : {}) }`.

Non-PDF : cette page n'est jamais atteinte pour un `.docx`/`.odt` (aucune
action "Ouvrir" ne pointe vers elle) — pas de traitement de repli à
construire dans cette itération.

## Tests

- `route.test.ts` de `/api/theses/[id]/comments` : étendu avec les deux
  nouvelles règles de validation (`page` sans `documentId` ; `page` avec
  `parentId`), plus un cas de création réussie avec `page` persisté.
- Nouveau `route.test.ts` pour `GET /api/documents/[id]` : trouvé (200),
  non-membre de la thèse (404), document inexistant (404).
- Pas d'infrastructure de test de composants dans ce dépôt — la page
  `/documents/[id]/view` et les actions "Ouvrir" restent en QA manuelle.

## Hors périmètre

- Édition réelle du contenu du fichier (rejeté en clarification — c'est
  une annotation, pas un éditeur).
- Position exacte (pin x/y) sur la page (rejeté — numéro de page seul).
- Annotation de `.docx`/`.odt` (rejeté — PDF uniquement, pas de conversion
  à la volée).
- Masquer le bouton de téléchargement natif du navigateur (nécessiterait
  un rendu PDF.js personnalisé, explicitement écarté).
