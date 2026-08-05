# Changer l'étape d'un étudiant — design

Date : 2026-08-05
Statut : approuvé par l'utilisateur, prêt pour le plan d'implémentation

## Contexte

Sur `/students/[id]` (Détail Étudiant, côté encadrant), l'étape actuelle du
mémoire (`Thesis.stage`) est affichée deux fois en lecture seule :
- la carte "Étape actuelle" sur la page principale
  (`frontend/src/app/students/[id]/page.tsx`)
- le badge à côté du nom dans le sidebar
  (`frontend/src/components/dashboard/StudentProfileSidebar.tsx`)

L'encadrant n'a aucun moyen de changer cette valeur depuis l'UI. L'objectif
est d'ajouter ce contrôle.

## Ce qui existe déjà (aucun changement requis)

`PATCH /api/theses/[id]` (`frontend/src/app/api/theses/[id]/route.ts`)
accepte déjà `{ stage?, progress? }`, protégé `ENCADRANT_ONLY` (403 sinon),
avec CSRF + auth + `resolveThesisAccess` déjà en place. Les 5 valeurs
valides sont fixées par un `z.enum` local :
`['En attente', 'Rédaction', 'Révision', 'Bloqué', 'Soutenance']`.
Déjà testé dans `route.test.ts` (401/403 CSRF, 400 valeur invalide, 200
succès).

Ces 5 valeurs correspondent exactement aux onglets déjà affichés sur
`/students` (`FilterBar.tsx`) — pas de "Terminé", décision confirmée avec
l'utilisateur : on garde les 5 valeurs existantes, pas de 6e étape.

## Décisions confirmées avec l'utilisateur

1. **Valeurs d'étape** : les 5 valeurs existantes, inchangées. Pas de
   migration Prisma (`stage` est un `String` libre, pas un enum DB).
2. **Transitions** : libres — un sélecteur avec les 5 valeurs, pas de
   restriction séquentielle. Nécessaire pour "Bloqué", qui peut survenir à
   n'importe quel moment du parcours, pas seulement en progression linéaire.
3. **Confirmation** : aucune. Sélection → sauvegarde immédiate → toast.
   Action facilement réversible (re-changer l'étape), pas de dialog
   bloquant — même logique que "Envoyer un retour" dans le même sidebar.
4. **Portée "instantané"** : l'encadrant voit le changement immédiatement
   dans son propre onglet (refetch après mutation, comme partout ailleurs
   dans l'app). `/students` et le dashboard étudiant afficheront la
   nouvelle valeur à leur prochain chargement — pas de polling, pas de
   push cross-session (Ably) pour cette fonctionnalité. C'est le
   comportement standard déjà en place partout dans l'app sauf `/messages`
   (qui poll toutes les 5s, cas différent).

## Design

### Composant

Dans `StudentProfileSidebar.tsx`, à côté du badge d'étape existant : un
bouton **"Changer d'étape"** qui bascule (`stageEditorOpen`, même pattern
que `composerOpen` pour "Envoyer un retour" juste en dessous) vers un petit
formulaire inline : un `<select>` natif (les 5 valeurs, valeur initiale =
étape actuelle) + boutons "Enregistrer" / "Annuler".

### Flux de données

1. Encadrant sélectionne une nouvelle valeur, clique "Enregistrer".
2. `api(PATCH /api/theses/{thesisId}, { method: 'PATCH', body: { stage } })`
   — réutilise `@/lib/api`, même wrapper que le composeur de commentaires.
3. Succès → `toast('Étape mise à jour.', 'success')`, ferme le formulaire,
   appelle un nouveau callback prop `onStageChanged?.()`.
4. `students/[id]/page.tsx` passe `onStageChanged={() => void refreshThesis()}`
   (même mécanique que `onCommentSent`) — `refreshThesis()` recharge
   `GET /api/theses/{id}`, donc le badge du sidebar ET la carte "Étape
   actuelle" de la page principale se mettent à jour depuis le même state,
   sans rechargement de page.
5. Erreur (`ApiError`) → toast rouge avec `err.message` (le serveur renvoie
   déjà des messages stables : 403 `ENCADRANT_ONLY`, 400
   `VALIDATION_FAILED`). Pas d'état d'erreur inline supplémentaire — le
   formulaire reste ouvert pour réessayer.

### Refactor de support : extraire la liste des étapes

La liste des 5 valeurs est aujourd'hui dupliquée dans deux endroits
(`route.ts`, `FilterBar.tsx`). Le nouveau `<select>` serait une 3e copie.
Extraction en une constante partagée `THESIS_STAGES` dans
`frontend/src/lib/theses.ts` (déjà propriétaire de `STAGE_COLORS`, donc
déjà le point central pour tout ce qui concerne les étapes) :

```ts
export const THESIS_STAGES = ['En attente', 'Rédaction', 'Révision', 'Bloqué', 'Soutenance'] as const;
```

- `route.ts` : `z.enum(THESIS_STAGES)` au lieu de la constante locale
  `STAGES`.
- `FilterBar.tsx` : ses 5 onglets référencent `THESIS_STAGES` au lieu de
  chaînes en dur (l'onglet "Tous" reste distinct, `stage: null`).
- Le nouveau composant : `<option>` générées depuis `THESIS_STAGES`.

### Responsive

Aucun travail spécifique requis. Le sidebar est déjà `w-full lg:w-80`
(empilé pleine largeur en mobile, colonne latérale en desktop). Le
`<select>` natif hérite du responsive du conteneur.

## Hors périmètre (explicitement exclu)

- Pas de 6e valeur "Terminé".
- Pas de restriction de transition séquentielle.
- Pas de dialog de confirmation.
- Pas de polling ni de push temps réel (Ably) pour la liste `/students` ou
  le dashboard étudiant.
- Pas de changement du champ `progress` (hors sujet de cette demande, qui
  porte uniquement sur `stage`).
- Pas de nouvelle route API, pas de migration Prisma.

## Tests

Backend déjà couvert (`route.test.ts` existant, aucun changement de
comportement serveur). Pas de nouveau test API nécessaire.

Vérification manuelle attendue lors de l'implémentation : `pnpm format &&
lint && typecheck && test && build`, puis test visuel sur le dev server à
375px (mobile, sidebar empilé) et desktop (sidebar `lg:w-80`) — changer
l'étape, vérifier que le badge + la carte "Étape actuelle" se mettent à
jour sans rechargement, vérifier le toast succès et un cas d'erreur (ex.
CSRF invalide n'est pas testable manuellement facilement, donc s'appuyer
sur le test automatisé existant pour ce cas).
