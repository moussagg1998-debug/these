# Reels — Remotion

Vidéos verticales Instagram / TikTok (1080x1920, 9:16, 30 fps) écrites en React + TypeScript.

## Démarrer

```bash
cd reels
npm install
npm run dev          # ouvre le Studio sur http://localhost:3000
```

## Exporter

```bash
npm run render:all                  # toutes les compositions -> out/<id>.mp4
npm run render:all -- Reel-Score    # seulement celles nommées
npm run render -- Reel-Epargne out/epargne.mp4   # une seule, via la CLI Remotion
```

Le premier rendu télécharge un navigateur Chrome headless (une fois) et a besoin d'internet pour la police Poppins.

## Organisation

| Fichier | Rôle |
|---|---|
| `src/theme.ts` | Charte : couleurs, police Poppins, tailles, zones de sécurité, volume musique |
| `src/components/` | `AnimatedNumber`, `KineticText`, `ProgressBar`, `Gauge`, `CTA` + `ReelLayout`, `SafeArea`, `Scene`, `BackgroundMusic` |
| `src/compositions/` | Un fichier par Reel (`ReelEpargne`, `ReelScore` en exemples) |
| `src/Root.tsx` | Liste des Reels : chaque `<Composition>` devient une vidéo |
| `public/` | `music.mp3` (musique de fond) et `logo.png` (logo du CTA), tous deux optionnels |

## Zones de sécurité

Rien d'important dans les 250 px du haut, les 400 px du bas ni les 120 px de droite.
Place ton contenu dans `<SafeArea>` et active `showSafeZones: true` dans les props du Studio pour voir les zones en rouge.

## Musique et logo

- `public/music.mp3` : jouée en boucle à 15 % de volume avec fondus. Absente = vidéo muette.
- `public/logo.png` : affiché dans le CTA. Absent = initiale du pseudo sur un rond dégradé.

Relance `npm run dev` après avoir ajouté un de ces fichiers. Utilise une musique libre de droits.

## Nouveau Reel

1. Copie `src/compositions/ReelScore.tsx` vers `src/compositions/MonReel.tsx` et modifie les scènes.
2. Ajoute une `<Composition id="Mon-Reel" ...>` dans `src/Root.tsx`.
3. `npm run render:all -- Mon-Reel`.

## Licence Remotion

Remotion est gratuit pour les particuliers et les entreprises de 3 personnes maximum ; au-delà, une licence entreprise est requise (voir remotion.dev/license).
