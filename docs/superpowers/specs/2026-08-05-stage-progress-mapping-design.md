# Progression dérivée de l'étape — design

Date : 2026-08-05
Statut : approuvé par l'utilisateur, prêt pour le plan d'implémentation

## Contexte

Le contrôle "Changer d'étape" (`StudentProfileSidebar.tsx`, spec du
2026-08-05-student-stage-change) permet déjà à l'encadrant de changer
`Thesis.stage`. Mais `Thesis.progress` (la barre "Avancement" affichée sur
`/students`, `/students/[id]` et le dashboard étudiant) reste figé à sa
valeur par défaut (0) — rien ne le relie à l'étape. L'objectif est que le
pourcentage se remplisse automatiquement quand l'étape change.

## Ce qui existe déjà (contexte, pas de changement)

- `Thesis.progress` : `Int @default(0)`, 0-100, `prisma/schema.prisma:391`.
- `Thesis.stage` : `String @default("En attente")`, 5 valeurs via
  `THESIS_STAGES` (`frontend/src/lib/theses.ts`).
- `PATCH /api/theses/[id]` (`frontend/src/app/api/theses/[id]/route.ts`)
  accepte aujourd'hui `{ stage?, progress? }` de façon indépendante —
  `resolveThesisAccess` a déjà chargé le thésis complet (donc l'étape et le
  pourcentage courants sont disponibles dans le handler sans requête
  supplémentaire).
- `POST /api/theses` (`frontend/src/app/api/theses/route.ts`) accepte un
  `stage` optionnel à la création (par défaut "En attente"), mais ne fixe
  jamais `progress` — il reste au défaut Prisma (0).
- `StudentProfileSidebar.tsx` envoie déjà `PATCH { stage: pendingStage }`
  sans `progress`, et `onStageChanged` → `refreshThesis()` réaffiche déjà
  `thesis.progress` partout où il est utilisé sur `/students/[id]`.

## Décisions confirmées avec l'utilisateur

1. **Mode** : automatique et figé — le pourcentage est entièrement dérivé
   de l'étape, pas un champ modifiable indépendamment.
2. **Mapping** :

   | Étape | Progression |
   |---|---|
   | En attente | 0% |
   | Rédaction | 40% |
   | Révision | 75% |
   | Soutenance | 100% |
   | Bloqué | *inchangé* — conserve la valeur précédente |

   "Bloqué" n'est pas un palier de progression linéaire (il peut survenir à
   n'importe quel moment) — passer à Bloqué ne fait ni avancer ni reculer
   le travail déjà accompli, donc le pourcentage courant est conservé tel
   quel.
3. **Source de vérité** : calculée côté serveur dans la route PATCH, pas
   côté client. Le champ `progress` est retiré du corps de requête accepté
   — il n'a plus de sens comme entrée indépendante (un appel API direct
   pourrait sinon désynchroniser le pourcentage de l'étape).

## Design

### Mapping partagé

Dans `frontend/src/lib/theses.ts`, à côté de `THESIS_STAGES` /
`STAGE_COLORS` :

```ts
export const STAGE_PROGRESS: Partial<Record<(typeof THESIS_STAGES)[number], number>> = {
  'En attente': 0,
  Rédaction: 40,
  Révision: 75,
  Soutenance: 100,
  // Bloqué délibérément absent — voir deriveProgress
};

export function deriveProgress(stage: (typeof THESIS_STAGES)[number], currentProgress: number): number {
  return STAGE_PROGRESS[stage] ?? currentProgress;
}
```

`deriveProgress` est la seule fonction qui décide du pourcentage — les deux
routes ci-dessous l'appellent, rien d'autre ne doit fixer `progress`
directement.

### `PATCH /api/theses/[id]`

- Le schéma Zod du body passe de `{ stage?, progress? }` à `{ stage? }` —
  `progress` n'est plus un champ accepté en entrée.
- Quand `stage` est fourni : `progress = deriveProgress(stage,
  access.progress)` (l'`access` chargé par `resolveThesisAccess` porte déjà
  le `progress` courant), et les deux champs sont écrits dans le même
  `prisma.thesis.update`.
- Quand `stage` est absent (body `{}`) : comportement inchangé, aucun champ
  mis à jour.

### `POST /api/theses`

- Quand `stage` est fourni à la création : `progress =
  deriveProgress(stage, 0)` (0 = valeur par défaut du champ, il n'y a pas
  de "précédent" à la création — donc créer directement en "Bloqué" donne
  0%, comme "En attente"). Écrit dans le même appel `prisma.thesis.create`.
- Quand `stage` est absent : comportement inchangé (défauts Prisma : "En
  attente" / 0%, déjà cohérents entre eux).

### Aucun changement UI

`StudentProfileSidebar.tsx` envoie déjà `PATCH { stage: pendingStage }`
sans `progress`, et `onStageChanged` déclenche déjà `refreshThesis()`, qui
réaffiche `thesis.progress` dans le badge et la carte "Étape actuelle".
Aucune modification de composant n'est nécessaire — la nouvelle valeur
dérivée apparaît automatiquement dès que la réponse PATCH est reçue. Même
"portée d'instantanéité" que la spec stage-change : à jour immédiatement
dans l'onglet de l'encadrant, à la prochaine visite ailleurs
(`/students`, dashboard étudiant).

## Hors périmètre (explicitement exclu)

- Pas de champ de saisie manuelle du pourcentage (même sujet que la spec
  stage-change : hors sujet).
- Pas de mapping différent par thèse (le barème est global, pas
  configurable par l'encadrant).
- Pas de migration Prisma — `progress` reste un `Int` libre, seule la
  façon dont il est *écrit* change.

## Tests

`frontend/src/app/api/theses/[id]/route.test.ts` :
- Retirer/adapter le test actuel qui envoyait `{ stage: 'Rédaction',
  progress: 40 }` et attendait ces deux valeurs telles quelles dans
  `update.data` (le comportement reste correct pour "Rédaction" par
  coïncidence de valeur, mais la requête ne doit plus contenir `progress`
  en entrée — le test doit vérifier que la valeur est *dérivée*, pas
  transmise).
- Un cas par étape non-Bloqué : le mapping est appliqué.
- Un cas "Bloqué" : `progress` inchangé par rapport à la valeur existante
  du thésis en fixture.
- Un cas "stage absent, body `{}`" : `progress` non touché (régression
  existante).

`frontend/src/app/api/theses/route.test.ts` :
- Un cas "création avec `stage: 'Révision'`" → `progress: 75` dans
  `create.data`.

Pas de nouveau test composant (convention du projet : zéro `.test.tsx`,
cf. spec stage-change). Vérification manuelle sur le dev server : changer
l'étape sur `/students/[id]`, confirmer que la barre "Avancement" du
sidebar/carte se remplit au pourcentage attendu, y compris le cas Bloqué
qui ne doit rien changer.
