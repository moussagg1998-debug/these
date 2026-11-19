import { getStaticFiles } from '@remotion/studio';

/**
 * Indique si un fichier existe dans le dossier public/.
 * La liste est figée au démarrage du Studio ou du rendu : après avoir ajouté un fichier,
 * relance `npm run dev`.
 */
export const hasStaticFile = (name: string): boolean =>
  getStaticFiles().some((file) => file.name === name);
