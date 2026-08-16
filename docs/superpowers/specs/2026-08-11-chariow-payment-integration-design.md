# Intégration Chariow — plan Essentiel — design

Date : 2026-08-11
Statut : approuvé par l'utilisateur, prêt pour le plan d'implémentation

## Contexte

`Chariow.md` (racine du repo) documente une intégration Chariow réelle et
détaillée, mais issue d'un **autre projet** (monorepo `backend/`+`frontend/`,
marketplace multi-créateurs avec `MobileMoneyAccount` par communauté). Le
document le dit lui-même (§1) : pour un SaaS qui vend ses propres plans (notre
cas), on utilise **un compte plateforme unique** au lieu d'un compte par
créateur — mais le contrat HTTP Chariow, les statuts, le webhook et la
réconciliation s'appliquent à l'identique. Cette spec adapte ce contrat à
l'architecture réelle de ThèseFacile.

Objectif : quand un encadrant connecté clique « Passer au plan Essentiel »,
il doit être redirigé vers un checkout Chariow réel, et voir son plan activé
seulement après confirmation fiable du paiement (jamais sur la foi du retour
navigateur seul).

## Ce qui existe déjà (réutilisé tel quel)

- `Order` (`prisma/schema.prisma`) est déjà provider-agnostique : `amount`,
  `currency`, `provider`, `providerChargeId @unique`, `paymentUrl`, `status
  PENDING|PAID|EXPIRED|FAILED|REFUNDED`, `metadata Json`. Pas de nouveau
  modèle de paiement nécessaire — un paiement Essentiel est un `Order` de
  plus, avec `provider = "chariow"`.
- `PaymentProvider` (`lib/server/payments/provider.ts`) — interface pluggable
  déjà conçue pour accueillir un second provider à côté de Bictorys.
- `createWebhookHandler` (`lib/server/webhook/handler.ts`, **protégé**) — déjà
  idempotent (`WebhookLog @@unique([externalId, eventType])`), déjà en
  transaction Serializable, déjà lu en raw body. Chariow s'y branche comme un
  provider de plus.
- Le cron générique `order-expiration` (`lib/server/orders/expire.ts`) expire
  déjà tout `Order` PENDING périmé **sans filtrer par provider** — aucune
  modification requise pour que les checkouts Chariow abandonnés expirent.
- Le pattern verrou advisory Postgres (`lib/server/withdrawals/lock.ts`) pour
  sérialiser les opérations concurrentes d'un même utilisateur.
- Le pattern singleton lazy + `CircuitBreaker` (`payments/provider-singleton.ts`)
  pour éviter qu'un provider mal configuré fasse planter le module au boot.
- `outbox`/`notifications/templates.ts` pour les effets de bord post-commit.

Rien de tout cela n'est copié depuis `Chariow.md` — seul le **contrat HTTP
Chariow** (§3, §3bis, §7 du fichier) fait foi et est repris fidèlement :
endpoints `POST /checkout` et `GET /sales/{id}`, forme du payload téléphone,
mapping de statuts, sécurité du webhook par secret en query string.

## Décisions confirmées avec l'utilisateur

1. **Périmètre** : seul le plan **Essentiel** est câblé de bout en bout.
   Premium n'existe pas encore sur la page Pricing — la configuration est
   structurée pour qu'ajouter Premium plus tard soit une entrée de config +
   une variable d'env, pas un changement d'architecture.
2. **Credentials** : l'utilisateur possède déjà un compte Chariow actif. Il
   ajoute lui-même les valeurs réelles dans `frontend/.env.local` — aucun
   secret ne transite par la conversation. Cette spec fixe uniquement les
   **noms** de variables.
3. **Récurrence** : Chariow n'expose pas d'abonnement récurrent dans le
   contrat documenté — seulement des checkouts ponctuels à prix fixe. Chaque
   paiement réussi accorde **30 jours** d'accès Essentiel
   (`User.planExpiresAt`). Un paiement effectué alors que l'accès est encore
   actif **prolonge** l'échéance de 30 jours à partir de l'échéance actuelle
   (pas de perte de jours payés) plutôt que de repartir de zéro.
4. **Téléphone** : Chariow exige `{ number local, country_code ISO2 }` +
   prénom/nom — rien n'est stocké aujourd'hui sur `User`. Un petit formulaire
   (mini-modal) collecte ces champs juste avant la redirection, sans les
   persister sur le profil (ils ne servent qu'à cette création de checkout,
   comme le fait Chariow lui-même).
5. **Hors périmètre v1** (confirmé) : pas de rappel proactif avant expiration
   (seule une notification au moment du downgrade) ; pas de plan Premium
   réel ; pas de catch-up 14 jours façon `Chariow.md` (remplacé par une
   fenêtre plus courte, voir plus bas — contexte différent : un seul compte
   plateforme, pas de flakiness par créateur).

## Modèle de données

```prisma
model User {
  // … champs existants inchangés …
  plan          String    @default("FREE") // "FREE" | "ESSENTIEL"
  planExpiresAt DateTime? // null si FREE ; échéance glissante si ESSENTIEL
}
```

Aucun autre modèle. L'historique des paiements est déjà porté par `Order`
(`provider: "chariow"`, `metadata: { plan: "ESSENTIEL" }`). Le « depuis quand »
affiché à l'utilisateur se déduit du dernier `Order` `PAID` du provider
chariow, pas d'une colonne dédiée.

Migration Prisma versionnée (`pnpm db:migrate:dev`) : ajout des 2 colonnes,
défaut `FREE` / `NULL` — rétrocompatible, aucune donnée existante affectée.

## Variables d'environnement (nouvelles)

| Variable | Rôle | Défaut |
|---|---|---|
| `CHARIOW_API_URL` | Base API Chariow | `https://api.chariow.com/v1` |
| `CHARIOW_API_KEY` | Clé API (Bearer), **serveur uniquement** | — (503 si absente) |
| `CHARIOW_PRODUCT_ID_ESSENTIEL` | `product_id` du produit Essentiel dans la boutique Chariow | — (503 si absente) |
| `CHARIOW_WEBHOOK_SECRET` | Secret comparé au `?secret=` du webhook | — (401 si absent/faux) |
| `CHARIOW_ESSENTIEL_PRICE_FCFA` | Prix attendu, pour l'anti-fraude à la réconciliation | `5900` (aligné sur `PLANS` de `page.tsx`) |
| `CHARIOW_RECONCILE_CATCHUP_DAYS` | Fenêtre de re-vérification des `Order` FAILED récents | `3` |

`PUBLIC_URL` (déjà utilisée par `/api/orders`) est réutilisée telle quelle
pour construire l'URL de retour — même garde-fou WR-06 (503 si absente en
prod).

## Backend

### 1. Adapter `lib/server/payments/chariow.ts` (nouveau)

Sur le modèle de `bictorys.ts` :

- `charge(input: ChargeInput): Promise<ChargeResult>` → `POST {CHARIOW_API_URL}/checkout`.
  Ne dérive **jamais** le montant du client : le `product_id` vient de
  `CHARIOW_PRODUCT_ID_ESSENTIEL`, et `input.amount` est comparé (égalité
  stricte) au prix serveur attendu avant tout appel réseau — un appelant qui
  passerait un montant erroné fait échouer l'appel avant même de contacter
  Chariow. Payload : `product_id`, `email`, `first_name`/`last_name`,
  `phone: { number, country_code }` (voir §Téléphone), `redirect_url`
  (un seul champ — Chariow n'a pas de `failure_url` distinct, contrairement à
  Bictorys), `custom_metadata: { userId, orderId, plan }`. Réponse :
  `data.purchase.id` → `providerChargeId`, `data.payment.checkout_url` →
  `paymentUrl`, `data.purchase.amount.{value,currency}` → `amount`/`currency`
  (champs optionnels ajoutés à `ChargeResult`, non-cassants pour Bictorys).
- `getSaleStatus(saleId): Promise<{ status, amount, currency, paidAt? }>` →
  `GET /sales/{id}` — utilisée uniquement par la réconciliation, jamais par
  le webhook seul.
- `mapChariowStatus(raw): 'succeeded'|'failed'|'abandoned'|'pending'` — reproduit
  exactement la table de `Chariow.md` §3.3, avec le piège d'ordre documenté :
  toute chaîne contenant `unpaid` teste `pending` **avant** le test générique
  `paid`, pour ne jamais confondre les deux.
- `webhookProvider: WebhookProvider<ChariowWebhookPayload>` — `verifySignature`
  retourne toujours `{ valid: true }` : Chariow n'a pas de signature de corps,
  la vérification réelle (secret en query string) a lieu dans le shim de
  route *avant* d'entrer dans la factory protégée (voir §3). `extractIds`
  reconnaît `successful.sale` / `settled.sale` / `completed.sale` comme
  `kind: 'paid'`.

### 2. Téléphone `lib/server/subscriptions/phone.ts` (nouveau)

`resolveChariowPhone({ phone, phoneCountry, phoneLocal })` — reproduit la
chaîne de repli à 4 niveaux de `Chariow.md` §3bis avec `libphonenumber-js`
(nouvelle dépendance — légère, c'est la lib standard pour ce problème, et le
document cite explicitement les échecs de checkout comme la cause n°1
d'incident). Retourne `{ number, countryCode }` ou `null` (→ 400
`PHONE_INVALID` dans la route).

### 3. Singleton + breaker `lib/server/payments/chariow-singleton.ts` (nouveau)

Mirror exact de `provider-singleton.ts` : `getChariowProvider()` lazy, lève
`ChariowProviderUnconfiguredError` si `CHARIOW_API_URL`/`_API_KEY`/
`_PRODUCT_ID_ESSENTIEL`/`_WEBHOOK_SECRET` manque → 503
`PAYMENT_PROVIDER_UNCONFIGURED` dans les routes. `breaker` dédié
(`chariow.charge`, mêmes seuils D-PAY-02 : 5 échecs / 30s / cooldown 60s) —
instance séparée du breaker Bictorys (isolation des pannes).

### 4. Verrou `lib/server/subscriptions/lock.ts` (nouveau)

`withSubscriptionLock(tx, userId, fn)` — `pg_advisory_xact_lock(hashtext('subscription:' || userId))`,
même technique que `withdrawals/lock.ts` mais avec un préfixe de hash distinct
(pas de collision avec le verrou retraits). Empêche deux clics rapides sur
« Passer au plan Essentiel » de créer deux `Order` PENDING concurrents.

### 5. Réconciliation `lib/server/subscriptions/reconcile.ts` (nouveau) — cœur du fulfilment

Deux fonctions :

- `reconcileChariowOrderCore(tx, order, provider)` — ne fait **aucun**
  `$transaction` (peut recevoir soit un `PrismaTransactionClient` soit un
  `PrismaClient`, pour être appelable depuis l'intérieur de la transaction
  déjà ouverte par la factory webhook). Logique :
  1. Si `order.status === 'PAID'` → no-op, retourne `{ status: 'PAID' }`
     (idempotence : ni le webhook, ni le poll, ni le cron ne créditent deux
     fois).
  2. Sinon `GET /sales/{id}` via l'adapter — **jamais de confiance dans le
     payload webhook seul**, conformément à `Chariow.md` §7 « Zéro confiance
     dans le corps ».
  3. `mapChariowStatus` : `pending` → no-op ; `failed`/`abandoned` → flip
     `Order.status = 'FAILED'` ; `succeeded` → étape 4.
  4. Anti-fraude montant (tolérance 5 %, même logique que le document) entre
     le montant réellement renvoyé par Chariow et `CHARIOW_ESSENTIEL_PRICE_FCFA`.
     Écart hors tolérance → `log.warn` `[Chariow] ANOMALIE montant — NON
     crédité`, **aucun crédit**, `Order` reste tel quel pour investigation
     manuelle (jamais au détriment de l'acheteur si le montant réel colle
     malgré une étiquette de devise différente).
  5. Si tout est cohérent : `Order.status = 'PAID'`, `paidAt` = date Chariow
     si fournie sinon `order.createdAt` (jamais `new Date()` — piège documenté
     en `Chariow.md` §11.3), `User.plan = 'ESSENTIEL'`,
     `User.planExpiresAt = addDays(max(now, user.planExpiresAt ?? now), 30)`,
     puis `enqueueOutbox(tx, { kind: 'notification.plan_activated', … })`
     dans la même transaction/tx reçue (jamais de closure post-commit).
  6. Le flip `Order.status` utilise `updateMany({ where: { id, status: {in:
     ['PENDING','FAILED']} } })` — si `count === 0`, une autre exécution
     concurrente a déjà traité cette vente : no-op silencieux (idempotence
     double, comme `Chariow.md` §5.2).
- `reconcileChariowOrder({ prisma, order, provider })` — wrapper appelé par
  la route `verify` et par le cron : ouvre sa propre transaction Serializable
  et délègue à `reconcileChariowOrderCore`.

Compromis assumé et documenté en commentaire : l'appel réseau `GET
/sales/{id}` a lieu *à l'intérieur* de la transaction Serializable quand
`reconcileChariowOrderCore` est invoqué depuis le webhook (la factory
protégée ne permet pas de le sortir de sa transaction). Impact limité — un
seul GET — et c'est la seule façon d'honorer « ne jamais créditer sur la foi
du seul webhook » avec l'infrastructure existante sans modifier un fichier
protégé. Pour rester sous le timeout par défaut d'une transaction interactive
Prisma (5 s), `getSaleStatus` utilise un `AbortController` à **4 s** quand il
est appelé depuis ce chemin (le webhook devient un best-effort rapide : s'il
timeout, la transaction échoue proprement — `WebhookLog` n'a pas
`processedAt`, un retry Chariow ou le cron `chariow-reconcile` referont le
travail). La route `verify` et le cron, qui ouvrent leur propre transaction
hors contrainte webhook, gardent le timeout HTTP standard de l'adapter
(30 s, comme `bictorys.ts`).

### 6. Routes API (nouvelles)

- **`POST /api/subscriptions/checkout`** — `requireAuth` + `verifyCsrf`. Body
  zod `{ plan: 'ESSENTIEL', firstName, lastName, phone, phoneCountry, phoneLocal }`
  (aucun champ montant — le prix ne vient jamais du client). Sous verrou
  advisory (§4) : supersède l'éventuel `Order` chariow PENDING encore ouvert
  du même user (même règle « pas d'empilement » que le document), crée un
  nouvel `Order` PENDING (`expiresAt = now + 2h`), appelle
  `breaker.execute(provider.charge(...))`, persiste `providerChargeId` +
  `paymentUrl` + montant réel, répond `201 { orderId, paymentUrl }`. Erreurs :
  400 `VALIDATION_FAILED` / `PHONE_INVALID`, 503
  `PAYMENT_PROVIDER_UNCONFIGURED`, 503 `PAYMENT_PROVIDER_UNAVAILABLE`
  (`CircuitOpenError`), 502 `PAYMENT_FAILED` — mêmes codes que `/api/orders`
  pour rester cohérent côté frontend.
- **`POST /api/subscriptions/verify`** — `requireAuth`. Body `{ orderId? }`
  (par défaut : dernier `Order` chariow de l'utilisateur). 404
  `ORDER_NOT_FOUND` si absent/pas à lui. Appelle `reconcileChariowOrder`,
  répond `{ status, plan, planExpiresAt }`. C'est la route pollée par la
  page de retour — jamais de lecture des seuls paramètres d'URL pour
  conclure.
- **`GET /api/subscriptions/status`** — `requireAuth`. Répond
  `{ plan, planExpiresAt, latestOrder: { id, status, amount, currency, paidAt } | null }`
  pour l'onglet Abonnement des réglages.
- **`POST /api/webhooks/chariow`** — shim fin, sur le modèle de
  `webhooks/bictorys/route.ts`. Lit `req.nextUrl.searchParams.get('secret')`
  **avant** tout accès au corps (pas de conflit avec l'invariant raw-body :
  l'URL n'est pas le corps), comparaison temps constant à
  `CHARIOW_WEBHOOK_SECRET` → 401 si absent/faux. Puis délègue à
  `createWebhookHandler({ prisma, provider: chariowWebhookProvider, onPaid })`
  où `onPaid` appelle `reconcileChariowOrderCore(tx, order, provider)` en
  résolvant l'`Order` via `custom_metadata.orderId` (repli : recherche par
  `providerChargeId = sale_id`).
- **`POST /api/cron/chariow-reconcile`** (5 min, `verifyCronSecret` +
  `withLease`) — reconcilie en lot tous les `Order` chariow `PENDING`, plus
  les `FAILED` de moins de `CHARIOW_RECONCILE_CATCHUP_DAYS` jours (filet pour
  un règlement tardif après un abandon d'onglet ou une panne webhook — version
  réduite du catch-up 14 jours du document, proportionnée à un seul compte
  plateforme). Ajouté à `vercel.json`.
- **`POST /api/cron/subscription-expiration`** (5 min, même pattern que
  `order-expiration`) — `User` dont `plan = 'ESSENTIEL'` et `planExpiresAt <
  now` → `plan = 'FREE'`, `planExpiresAt = null`, `enqueueOutbox(kind:
  'notification.plan_expired')`. Ajouté à `vercel.json`.

### 7. Notifications & outbox (extensions, pas de réécriture)

- `outbox/types.ts` : + `NotificationPlanActivatedEvent` (`kind:
  'notification.plan_activated'`), `NotificationPlanExpiredEvent` (`kind:
  'notification.plan_expired'`).
- `notifications/templates.ts` : + `planActivated(userId, plan, expiresAt)`,
  `planExpired(userId)` — `dedupeKey` = `plan-activated:${orderId}` /
  `plan-expired:${userId}:${expiresAt}` pour l'at-most-once.
- `outbox/dispatcher.ts` (**protégé** pour ses invariants de claim atomique/
  backoff) : ajout de 2 `case` dans le `switch` existant, exactement le point
  d'extension documenté en tête du fichier (« Add new variants here, then
  handle them in dispatcher.ts »). Aucune modification de la logique de
  claim/backoff — signalé explicitement à l'utilisateur avant l'édition.

## Frontend

- **CTA page d'accueil** (`app/page.tsx`) : la carte Essentiel devient un
  petit composant client `PricingCTA.tsx` — utilisateur non connecté → lien
  `/signup` inchangé ; connecté → lien `/settings?tab=abonnement`. La carte
  Gratuit garde son lien `/signup` tel quel.
- **Onglet « Abonnement »** dans `/settings` (3ᵉ onglet à côté de
  Profil/Paramètres, lu depuis `?tab=`) : carte de statut (`GET
  /api/subscriptions/status`) affichant clairement le plan actuel, l'échéance
  si Essentiel, et le bouton d'action.
  - `SubscriptionTab.tsx` : si `FREE` → bouton « Passer au plan Essentiel »
    ouvrant `UpgradeModal.tsx` (téléphone + pays + prénom/nom, pré-rempli
    depuis `name`/`email` du profil si dispo) ; soumission → `POST
    /api/subscriptions/checkout` → état bouton « Redirection vers Chariow… »
    → `window.location.href = paymentUrl`. Si `ESSENTIEL` → affiche
    l'échéance + bouton « Renouveler maintenant » (même flux, prolonge
    l'échéance).
  - Erreurs mappées via `ApiError.code` → messages français, même pattern que
    `AddStudentForm.tsx` (`ERROR_MESSAGES` record).
- **Page de retour** `app/subscribe/return/page.tsx` (client) — lue par
  `redirect_url`. États : *En attente* (poll `POST
  /api/subscriptions/verify` toutes les 3 s, jusqu'à 60 s dur) → *Paiement
  réussi* (redirige vers `/settings?tab=abonnement` avec toast) ; au-delà de
  60 s sans confirmation → *Ça prend plus de temps que prévu, le
  rapprochement se termine automatiquement* (jamais un échec affirmé) ;
  `status=` dans l'URL sert uniquement d'indice d'affichage initial, jamais
  de source de vérité — seul le poll conclut.
- Responsive : mini-modal et page de retour en Tailwind, mêmes classes que le
  reste de l'app (`rounded-md`, `border-border`, `bg-surface`) — testé à
  375 px / tablette / desktop pendant le QA manuel.

## Sécurité — correspondance avec les exigences

| Exigence | Où |
|---|---|
| Utilisateur authentifié | `requireAuth` sur `checkout`/`verify`/`status` |
| Bon produit/plan associé | `product_id` fixé côté serveur par `plan`, jamais reçu du client |
| Montant reçu = montant attendu | Anti-fraude tolérance 5 % dans `reconcileChariowOrderCore`, jamais crédité sinon |
| Paiement pas déjà traité | `updateMany` conditionnel sur `status IN (PENDING,FAILED)` + check `PAID` en tête de `reconcileChariowOrderCore` |
| Webhook non rejouable | `WebhookLog @@unique([externalId, eventType])` (factory protégée) |
| Utilisateur ne change pas son plan lui-même | Aucune route n'expose `plan`/`planExpiresAt` en écriture directe ; seule la réconciliation serveur les modifie |
| Idempotence crédit | `Order.providerChargeId @unique` + check `PAID` avant tout crédit |

## Hors périmètre (explicitement exclu)

- Plan Premium réel (structure prête, pas câblée).
- Rappel proactif avant expiration.
- Catch-up 14 jours façon document source (remplacé par 3 jours, contexte
  compte unique).
- Remises/`discount_code` Chariow (pas de code promo demandé).
- Paiement carte bancaire via Chariow (`handlesCards`) — le contrat API est
  identique, seule l'UI de sélection de méthode n'est pas construite.

## Tests & QA

Automatisés (Vitest, même convention que le reste du repo — un `*.test.ts`
par module serveur nouveau) :
- `chariow.ts` : `mapChariowStatus` (tous les cas de la table + piège
  `unpaid`), `charge()` (mock fetch, rejet si montant ≠ attendu).
- `phone.ts` : les 4 niveaux de repli + cas d'échec.
- `reconcile.ts` : idempotence (rejouer sur `Order` déjà `PAID`), anti-fraude
  montant, extension d'échéance si renouvellement anticipé.
- Route `checkout` : 401 sans auth, CSRF, verrou (deux requêtes concurrentes
  → un seul `Order` actif), 503 si env absente.
- Route `verify` : 404 sur order d'un autre user.
- Webhook : secret invalide → 401 ; rejeu du même événement → `deduped: true`
  sans second crédit.

QA manuelle guidée (checklist du message utilisateur), sur `pnpm dev` avec
les vraies credentials Chariow une fois posées dans `.env.local` :
Pricing → checkout → paiement réussi (vrai mobile money test si Chariow
fournit un mode sandbox, sinon paiement réel minimal) → webhook → confirmation
→ activation ; puis paiement annulé, paiement échoué, webhook rejoué
manuellement (même payload deux fois), renouvellement d'un compte déjà
Essentiel, tentative avec un montant Chariow différent de
`CHARIOW_ESSENTIEL_PRICE_FCFA` (si simulable).

Avant de considérer la tâche terminée : `pnpm format && pnpm lint && pnpm
typecheck && pnpm test` (+ `pnpm build` si le temps le permet), corriger tout
ce qui casse.
