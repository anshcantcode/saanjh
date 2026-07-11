import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const sourceAssets = path.join(root, '..', 'assets');
const outputAssets = path.join(root, 'public', 'assets');
const jobs = [
  ['botanical-emblem.png', 512, 86],
  ['consent-botanical.png', 1440, 83],
  ['home-forest-path.png', 1440, 83],
  ['journal-stilllife.png', 1440, 83],
  ['mood-ripples.png', 960, 83],
  ['paper-topography.png', 900, 78],
  ['session-forest-night.png', 960, 84],
  ['welcome-forest.png', 960, 84],
];

await Promise.all(jobs.map(async ([filename, width, quality]) => {
  const source = path.join(sourceAssets, filename);
  const destination = path.join(outputAssets, filename.replace(/\.png$/i, '.webp'));
  await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toFile(destination);
}));

console.log(`Optimized ${jobs.length} Saanjh assets.`);
