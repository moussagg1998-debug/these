// Réglages utilisés par `npm run dev` et `npm run render`.
// `npm run render:all` applique les mêmes réglages dans scripts/render-all.mjs.
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(18);
