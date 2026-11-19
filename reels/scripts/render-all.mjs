// Exporte toutes les compositions de src/Root.tsx dans out/<id>.mp4.
// Usage : npm run render:all                -> toutes les vidéos
//         npm run render:all -- Reel-Score  -> seulement celles nommées
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out');
const only = process.argv.slice(2);
// Optionnel : chemin vers un Chrome/Chromium déjà installé.
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;

fs.mkdirSync(outDir, { recursive: true });

console.log('Préparation du projet…');
const serveUrl = await bundle({
  entryPoint: path.join(root, 'src', 'index.ts'),
  rootDir: root,
  publicDir: path.join(root, 'public'),
});

const compositions = (await getCompositions(serveUrl, { browserExecutable })).filter(
  (c) => only.length === 0 || only.includes(c.id),
);

if (compositions.length === 0) {
  console.error(`Aucune composition trouvée${only.length ? ` pour : ${only.join(', ')}` : ''}.`);
  process.exit(1);
}

for (const [index, composition] of compositions.entries()) {
  const outputLocation = path.join(outDir, `${composition.id}.mp4`);
  const prefix = `[${index + 1}/${compositions.length}] ${composition.id}`;
  let lastPercent = -1;

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    pixelFormat: 'yuv420p',
    crf: 18,
    imageFormat: 'jpeg',
    outputLocation,
    browserExecutable,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 100);
      if (percent !== lastPercent && percent % 10 === 0) {
        lastPercent = percent;
        console.log(`${prefix} : ${percent} %`);
      }
    },
  });

  console.log(`${prefix} : terminé -> ${path.relative(root, outputLocation)}`);
}

console.log(`\n${compositions.length} vidéo(s) exportée(s) dans out/`);
