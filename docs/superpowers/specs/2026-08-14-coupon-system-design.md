# Système de coupons de réduction — design spec

**Date:** 2026-08-14
**Status:** Approved by user, pending implementation plan

## Problem

ThèseFacile a un unique plan payant (`ESSENTIEL`, 5900 FCFA/mois par défaut, `PLAN_CONFIG` dans `frontend/src/lib/server/subscriptions/plans.ts`), facturé via Chariow — un prestataire de checkout hébergé pour Mobile Money/carte. Il n'existe aujourd'hui aucun mécanisme de code promo/coupon : le prix payé est toujours le prix plein, sans exception.

Le besoin : un coupon `THESIS` à -95%, utilisable par tout utilisateur mais une seule fois chacun, dont le montant (initial / réduction / final) est affiché clairement au moment du paiement, et que l'admin peut modifier ou désactiver depuis le back-office.

## Contrainte technique déterminante

`frontend/src/lib/server/payments/chariow.ts` (`charge()`, lignes 83-158) confirme que **Chariow ne reçoit jamais de montant par transaction** — le corps envoyé à `POST {baseUrl}/checkout` contient `product_id`, l'identité du client et l'URL de retour, mais aucun champ `amount`. Le prix facturé est entièrement déterminé côté tableau de bord Chariow, associé au `product_id` (`CHARIOW_PRODUCT_ID_ESSENTIEL`, un seul produit configuré aujourd'hui). Il est donc impossible de faire payer dynamiquement 295 FCFA (5% de 5900) via un appel Chariow standard sans configurer un second produit à prix fixe dans leur tableau de bord — une dépendance opérationnelle externe, fragile, et non pilotable depuis notre back-office.

**Décision (validée avec l'utilisateur) :** un coupon valide fait sauter complètement l'appel à Chariow. La commande est créée directement au statut `PAID` avec `provider: "coupon"`, et l'abonnement est activé immédiatement dans la même transaction verrouillée — sans transaction bancaire réelle pour le solde restant. Le montant final (295 FCFA pour THESIS) est enregistré pour la traçabilité/l'affichage, mais n'est pas collecté par un prestataire de paiement. Sans coupon, le flux Chariow existant (`checkout` → webhook/`verify`/cron → `reconcileChariowOrderCore`) reste **strictement inchangé** — ce spec n'y touche que pour en extraire une fonction d'activation partagée (voir Architecture, §Refactor).

## Non-goals (explicitement hors périmètre)

- **Coupons à montant fixe** (vs. pourcentage). L'utilisateur a spécifié "Type : pourcentage" — le schéma n'a qu'un `discountPercent`, pas de champ `type` générique pour une variante jamais utilisée (YAGNI).
- **Coupons limités à un plan précis autre qu'ESSENTIEL.** Il n'existe qu'un seul plan payant aujourd'hui ; le champ n'est pas ajouté pour un futur plan hypothétique.
- **Suppression physique d'un coupon.** "Modifier ou désactiver" ⇒ `isActive: false` suffit et préserve l'historique de rachats (`CouponRedemption`) pour l'audit.
- **Coupon applicable à un renouvellement différent du flux d'achat existant.** Le checkout gère déjà premier achat et prolongation de façon identique (`reconcileChariowOrderCore` prolonge depuis l'expiration courante si encore active) ; un coupon suit exactement la même route, sans distinction premier-achat/renouvellement.
- **Second produit Chariow à prix réduit.** Écarté explicitement au profit du bypass complet (voir ci-dessus).

## In scope

1. Deux nouveaux modèles Prisma (`Coupon`, `CouponRedemption`) + une 3ᵉ valeur pour `Order.provider` (`"coupon"`).
2. `POST /api/subscriptions/checkout` accepte un `couponCode` optionnel ; applique intégralement la logique de réduction/activation sans jamais toucher au flux Chariow existant.
3. `GET /api/subscriptions/coupon-preview` — prévisualisation en lecture seule, pour l'affichage avant paiement.
4. CRUD admin complet (`GET`/`POST /api/admin/coupons`, `PATCH /api/admin/coupons/[id]`) + page `frontend/src/app/admin/coupons/page.tsx` + entrée `AdminSidebar`.
5. Script de seed créant le coupon `THESIS` (-95%, actif, sans plafond ni expiration).
6. `UpgradeModal.tsx` gagne un champ "Code promo" avec aperçu de la réduction.
7. Refactor ciblé : extraction de la logique d'activation de plan de `reconcile.ts` vers une fonction partagée, réutilisée par le nouveau chemin coupon.

## Architecture

### Modèle de données

```prisma
model Coupon {
  id              String    @id @default(cuid())
  code            String    @unique   // stocké en MAJUSCULES
  discountPercent Int                 // 1-100
  isActive        Boolean   @default(true)
  maxRedemptions  Int?                // null = illimité
  expiresAt       DateTime?           // null = jamais
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  redemptions     CouponRedemption[]

  @@index([code])
}

model CouponRedemption {
  id         String   @id @default(cuid())
  couponId   String
  coupon     Coupon   @relation(fields: [couponId], references: [id], onDelete: Restrict)
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  orderId    String   @unique
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Restrict)
  redeemedAt DateTime @default(now())

  @@unique([couponId, userId])
  @@index([userId])
}
```

`Order` gagne le champ de relation inverse `couponRedemption CouponRedemption?` (requis par Prisma pour toute relation référencée par FK) et `User` gagne `couponRedemptions CouponRedemption[]`. `Order.provider` reste un `String` libre (pas un enum Prisma, comme aujourd'hui) — `"coupon"` s'ajoute simplement comme 3ᵉ valeur possible aux côtés de `"bictorys"`/`"chariow"`.

Le nombre d'utilisations n'est **pas** dénormalisé sur `Coupon` (pas de `redemptionCount` mutable) : à la fois la vérification du plafond au checkout et l'affichage admin comptent `CouponRedemption` via `count()`. Sous le verrou `coupon:{code}` (voir ci-dessous), ce compte est fiable sans risque de désynchronisation d'un compteur séparé.

### Verrouillage (`frontend/src/lib/server/subscriptions/lock.ts`)

Nouvelle fonction, à côté de `lockSubscriptionTx` existante :

```ts
export async function lockCouponTx(tx: SubscriptionTxClient, code: string): Promise<void> {
  await tx.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    `coupon:${code}`,
  );
}
```

Verrouille sur le code lui-même (normalisé majuscule) — pas besoin de résoudre l'id du coupon avant de verrouiller. Sérialise tous les rachats d'un même coupon entre eux (peu importe l'utilisateur), ce qui rend le plafond `maxRedemptions` exact sous concurrence : deux utilisateurs différents redeemant `THESIS` en même temps ne peuvent pas dépasser le plafond, contrairement à `lockSubscriptionTx` seul qui ne sérialise que par utilisateur.

### Nouveau module `frontend/src/lib/server/subscriptions/coupons.ts`

```ts
export type CouponValidationError =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_EXPIRED'
  | 'COUPON_MAX_REDEMPTIONS'
  | 'COUPON_ALREADY_USED';

export function normalizeCouponCode(raw: string): string; // trim + toUpperCase

export function computeDiscountedAmount(originalAmount: number, discountPercent: number): number; // Math.round(originalAmount * (100 - discountPercent) / 100)

// Lecture seule — utilisable avec `prisma` (preview, hors verrou) ou `tx` (checkout, sous verrou).
// Ne mute rien ; le checkout revalide toujours À L'INTÉRIEUR du verrou avant d'écrire.
export async function validateCoupon(
  client: Pick<PrismaClient, 'coupon' | 'couponRedemption'>,
  code: string,
  userId: string,
): Promise<
  | { ok: true; coupon: Coupon }
  | { ok: false; error: CouponValidationError }
>;
```

`validateCoupon` encapsule les 5 vérifications (existe, actif, non expiré, plafond, jamais utilisé par cet utilisateur) — appelée par la route de preview (sans verrou, best-effort) et par le checkout (sous verrou, autoritaire). Le principe "ne jamais faire confiance à la preview" déjà en vigueur pour `/verify` (qui ne fait jamais confiance aux paramètres d'URL) s'applique ici : la preview peut retourner `valid: true` puis le checkout échouer une fraction de seconde plus tard (coupon désactivé entre-temps, plafond atteint par un autre utilisateur) — le checkout est la seule source de vérité.

### Refactor : fonction d'activation partagée

`frontend/src/lib/server/subscriptions/reconcile.ts` (lignes 182-198) contient la logique "prolonger depuis l'expiration actuelle si encore active, sinon repartir de maintenant, puis notifier" — extraite en :

```ts
// frontend/src/lib/server/subscriptions/activate.ts
export async function activatePlanFromOrder(
  tx: Pick<PrismaClient, 'user' | 'outboxEvent'>,
  input: { userId: string; orderId: string; plan: PlanId },
): Promise<{ planExpiresAt: Date }>;
```

`reconcileChariowOrderCore` appelle cette fonction au lieu de son bloc inline (comportement strictement identique, testé par les tests existants de `reconcile.test.ts` qui ne doivent pas changer d'assertions). Le nouveau chemin coupon dans `checkout/route.ts` appelle la même fonction — garantissant que l'activation est identique quel que soit le mode de paiement (même prolongation, même notification `plan_activated`).

### `POST /api/subscriptions/checkout` — extension

Body Zod existant + `couponCode: z.string().trim().min(1).max(40).optional()`. Comportement :

- **Sans `couponCode`** : aucun changement — flux Chariow intact.
- **Avec `couponCode`** :
  1. `normalizeCouponCode`.
  2. Transaction `Serializable` : `lockSubscriptionTx(tx, userId)` **puis** `lockCouponTx(tx, code)` (cet ordre précis, jamais l'inverse, pour éviter tout risque de deadlock avec un futur appelant qui verrouillerait dans l'autre sens — un seul ordre canonique dans toute la codebase).
  3. `validateCoupon(tx, code, userId)` — échec ⇒ lève une erreur sentinelle typée par code, catchée après la transaction et traduite en réponse JSON (même pattern que `SubscriptionInFlightError` existant).
  4. `price = expectedPriceFcfa('ESSENTIEL')`, `finalAmount = computeDiscountedAmount(price, coupon.discountPercent)`.
  5. Création `Order` (`status: 'PAID'`, `provider: 'coupon'`, `amount: finalAmount`, `paidAt: now()`, `providerChargeId: null`, `paymentUrl: null`, `metadata: { plan: 'ESSENTIEL', couponCode: coupon.code, originalAmount: price, discountPercent: coupon.discountPercent }`).
  6. Création `CouponRedemption` (`couponId`, `userId`, `orderId`).
  7. `activatePlanFromOrder(tx, { userId, orderId: order.id, plan: 'ESSENTIEL' })`.
  8. Réponse `201 { orderId, paymentUrl: null, coupon: { code, discountPercent, originalAmount: price, finalAmount }, plan: 'ESSENTIEL', planExpiresAt }`.

Ce chemin ne passe ni par `getChariowProvider()`, ni par `chariowBreaker`, ni par le garde-fou `PUBLIC_URL` — aucune dépendance au prestataire de paiement pour un checkout couponné. L'erreur de validation du coupon retourne `422` avec le code stable correspondant (`COUPON_NOT_FOUND`/`COUPON_INACTIVE`/`COUPON_EXPIRED`/`COUPON_MAX_REDEMPTIONS`/`COUPON_ALREADY_USED`) — jamais un contournement silencieux vers le plein tarif.

### `GET /api/subscriptions/coupon-preview`

Nouveau fichier `frontend/src/app/api/subscriptions/coupon-preview/route.ts`. `requireAuth` (pas de CSRF — lecture seule), query param `code`. Appelle `validateCoupon(prisma, normalizeCouponCode(code), userId)` sans verrou ni transaction. Réponse toujours `200` :

```ts
{ valid: true, code: string, discountPercent: number, originalAmount: number, finalAmount: number }
// ou
{ valid: false, reason: CouponValidationError }
```

### CRUD admin

`frontend/src/app/api/admin/coupons/route.ts` :
- `GET` — `requireAdmin('ADMIN')` → rate limit → `prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { _count: { select: { redemptions: true } } } })`. Pas de recherche/pagination poussée — un nombre de coupons attendu très faible (dizaines), même précédent que `/api/admin/institutions`.
- `POST` — `verifyCsrf` → `requireAdmin('ADMIN')` → rate limit → Zod (`code` 3-40 caractères alphanumériques, `discountPercent` 1-100 entier, `maxRedemptions` entier positif optionnel, `expiresAt` date ISO optionnelle) → normalise `code` en majuscules → vérifie l'unicité (sinon `409 COUPON_CODE_TAKEN`) → `prisma.coupon.create` → `logAdminAction(prisma, { actorId, action: 'coupon.create', targetType: 'Coupon', targetId, metadata: {...} })`.

`frontend/src/app/api/admin/coupons/[id]/route.ts` :
- `PATCH` — mêmes gardes. Zod partiel (`discountPercent`, `maxRedemptions`, `expiresAt`, `isActive` — tous optionnels, au moins un requis). `code` n'est **jamais** modifiable après création (identifiant public déjà potentiellement partagé). Transaction : lit l'état avant, applique l'update, `logAdminAction(tx, { action: 'coupon.update', metadata: { from: {...}, to: {...} } })` — même pattern before/after que `users/[id]/status/route.ts`.

### Page admin `frontend/src/app/admin/coupons/page.tsx`

`'use client'`, gabarit `AdminShell` identique aux autres pages admin. Tableau : code, réduction (%), statut (badge actif/inactif), utilisations (`_count.redemptions` / `maxRedemptions ?? '∞'`), expiration (date ou "—"), bouton "Modifier" ouvrant un formulaire (réduction, plafond, expiration, actif/inactif). Bouton "+ Nouveau coupon" ouvrant le même formulaire en mode création (avec le champ `code`, verrouillé après création). Pas de recherche/debounce — liste courte. `AdminSidebar.tsx` gagne une entrée `{ href: '/admin/coupons', icon: 'percent', label: 'Coupons' }`.

### Seed

`frontend/scripts/seed-coupon-thesis.ts` (ou intégré au script de migration existant le plus proche) — `prisma.coupon.upsert({ where: { code: 'THESIS' }, create: { code: 'THESIS', discountPercent: 95, isActive: true }, update: {} })`. `upsert` avec `update: {}` : idempotent, ne réinitialise jamais un THESIS déjà modifié par un admin si le script est relancé.

### `UpgradeModal.tsx`

Ajout d'un champ "Code promo" (optionnel) + bouton "Appliquer" appelant `GET /api/subscriptions/coupon-preview`. Si `valid: true`, affichage du détail :

```
Prix normal :     5 900 FCFA
Réduction (-95%) :  -5 605 FCFA
Total à payer :       295 FCFA
```

Si `valid: false`, message d'erreur inline (mapping `reason` → texte, même table `ERROR_MESSAGES` que les erreurs de paiement existantes). À la soumission (`onSubmit`), le `couponCode` appliqué est transmis dans le body de `POST /api/subscriptions/checkout`. Si la réponse contient `paymentUrl` (chaîne non vide), comportement inchangé (redirection Chariow). Si `paymentUrl` est `null` (chemin coupon), affichage direct d'un état de succès dans la modale ("Abonnement Essentiel activé !") puis fermeture + `refresh()` du statut, sans redirection.

## Error handling — codes stables

| Code | HTTP | Origine |
|---|---|---|
| `COUPON_NOT_FOUND` | 422 (checkout) / 200 `valid:false` (preview) | code inexistant |
| `COUPON_INACTIVE` | idem | `isActive: false` |
| `COUPON_EXPIRED` | idem | `expiresAt` dépassé |
| `COUPON_MAX_REDEMPTIONS` | idem | plafond global atteint |
| `COUPON_ALREADY_USED` | idem | déjà utilisé par cet utilisateur (`CouponRedemption` existant) |
| `COUPON_CODE_TAKEN` | 409 (admin `POST`) | code déjà pris à la création |

Le checkout sans coupon garde exactement ses codes d'erreur actuels (`PHONE_INVALID`, `PAYMENT_PROVIDER_UNCONFIGURED`, `PAYMENT_IN_FLIGHT`, `PAYMENT_FAILED`, etc.) — aucun n'est renommé ni supprimé.

## Testing plan

- `frontend/src/lib/server/subscriptions/coupons.test.ts` (new) : les 5 cas d'échec de `validateCoupon` + le cas valide, `computeDiscountedAmount` (arrondi, y compris un pourcentage produisant un montant non entier), `normalizeCouponCode`.
- `frontend/src/lib/server/subscriptions/activate.test.ts` (new) : extraction fidèle — mêmes assertions que le bloc précédemment inline dans `reconcile.test.ts` (prolongation depuis expiration active vs. depuis maintenant, notification enqueue).
- `frontend/src/lib/server/subscriptions/reconcile.test.ts` (modifié seulement si nécessaire pour pointer vers la fonction extraite — aucune assertion de comportement ne change).
- `frontend/src/app/api/subscriptions/checkout/route.test.ts` (étendu) : checkout avec coupon valide (Order PAID + provider coupon + plan activé, pas d'appel à `getChariowProvider`), chacun des 5 codes d'erreur coupon (422, aucune mutation), verrouillage — deux requêtes concurrentes sur un coupon à `maxRedemptions: 1` ⇒ une seule réussit, l'autre reçoit `COUPON_MAX_REDEMPTIONS`, double-usage par le même utilisateur ⇒ `COUPON_ALREADY_USED` y compris en simulant la contrainte `@@unique` (P2002) comme filet de sécurité.
- `frontend/src/app/api/subscriptions/coupon-preview/route.test.ts` (new) : chaque état retourné, jamais de mutation (aucun appel `create`/`update` sur le mock Prisma).
- `frontend/src/app/api/admin/coupons/route.test.ts` + `.../[id]/route.test.ts` (new) : gardes admin/CSRF/rate-limit, création (+ unicité), modification (+ `logAdminAction` appelé avec le bon before/after), `code` non modifiable via `PATCH`.
- Vérification manuelle (`pnpm dev`) : `UpgradeModal` avec `THESIS` affiche 5900 → -95% → 295, active le plan sans redirection ; retenter `THESIS` avec le même compte échoue avec message clair ; page `/admin/coupons` liste/crée/modifie/désactive ; un coupon désactivé depuis l'admin est immédiatement refusé au checkout.

## Files touched

**New:**
- `frontend/src/lib/server/subscriptions/coupons.ts` + `.test.ts`
- `frontend/src/lib/server/subscriptions/activate.ts` + `.test.ts`
- `frontend/src/app/api/subscriptions/coupon-preview/route.ts` + `.test.ts`
- `frontend/src/app/api/admin/coupons/route.ts` + `.test.ts`
- `frontend/src/app/api/admin/coupons/[id]/route.ts` + `.test.ts`
- `frontend/src/app/admin/coupons/page.tsx`
- `frontend/scripts/seed-coupon-thesis.ts`
- Prisma migration adding `Coupon`, `CouponRedemption`, `Order.couponRedemption`, `User.couponRedemptions`

**Modified:**
- `frontend/prisma/schema.prisma`
- `frontend/src/lib/server/subscriptions/lock.ts` — add `lockCouponTx`
- `frontend/src/lib/server/subscriptions/reconcile.ts` — replace inline activation block with `activatePlanFromOrder` call
- `frontend/src/app/api/subscriptions/checkout/route.ts` — add `couponCode` branch
- `frontend/src/components/dashboard/UpgradeModal.tsx` — coupon field + preview + non-redirect success path
- `frontend/src/components/admin/AdminSidebar.tsx` — add "Coupons" nav entry

**Not touched:** `payments/chariow.ts`, `payments/chariow-singleton.ts`, `payments/circuit-breaker.ts` (protected), `webhook/handler.ts` (protected), the Chariow webhook route, `subscriptions/expire.ts`, `subscriptions/plans.ts`, `subscriptions/entitlements.ts`/`require-feature.ts` — the coupon path is entirely additive around the existing Chariow flow, never inside it.
