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
| `src/components/` | `AnimatedNumber`, `KineticText`, `ProgressBar`, `Gauge`, `CTA` + `ReelLayout`, `SafeArea`, `Scene`, `BackgroundMusic`, `VoiceOver` |
| `src/components/fx/` | `Camera` (travelling + coups de zoom), `zoomBlur` (transition), `Slam`, `ConfettiBurst`, `Sparkles`, `FloatingCoins`, `Backdrop`, `Sfx` |
| `src/components/illustrations/` | Illustrations vectorielles animées : `PiggyBank`, `Coin`, `CoinStacks`, `Trophy`, `Stamp`, `Stars`, `CommentBubble`, `QuestionOrb` |
| `src/compositions/` | Un fichier par Reel (`ReelEpargne`, `ReelScore` en exemples) |
| `src/Root.tsx` | Liste des Reels : chaque `<Composition>` devient une vidéo |
| `src/voiceover.ts` | Voix ElevenLabs utilisée et calage des scènes sur la voix off |
| `public/voiceover/` | Clips de voix off, un par scène : `<id du Reel>/<scène>.mp3` |
| `public/sfx/` | Bruitages (whoosh, coin, pop, ding, success), synthétisés, libres de droits |
| `public/` | `music.mp3` (musique de fond) et `logo.png` (logo du CTA), tous deux optionnels |

## Voix off

Voix ElevenLabs « Adam - Engaging, Friendly and Bright » (modèle `eleven_v4`).
Chaque scène lit `public/voiceover/<Reel>/<scène>.mp3` et s'allonge automatiquement si la voix est plus longue.
La musique baisse sous la voix (6 % au lieu de 15 %). Sans clip, la scène garde sa durée minimale et reste muette.

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
