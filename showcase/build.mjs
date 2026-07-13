import { cp, copyFile, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const publicRoot = path.join(root, 'public');
const sharedAssets = path.resolve(root, '../web/public/assets');
const exists = async (target) => stat(target).then(() => true).catch(() => false);

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'assets'), { recursive: true });
await copyFile(path.join(root, 'index.html'), path.join(dist, 'index.html'));
if (await exists(publicRoot)) await cp(publicRoot, dist, { recursive: true });
if (await exists(sharedAssets)) {
  await cp(sharedAssets, path.join(dist, 'assets'), { recursive: true, force: false, errorOnExist: false });
}

console.log(`Saanjh showcase built at ${dist}`);
