import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const directory = path.resolve(root, process.argv[2] || '.');
const port = Number(process.argv[3] || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    let target = path.join(directory, decodeURIComponent(url.pathname));
    const info = await stat(target).catch(() => null);
    if (info?.isDirectory()) target = path.join(target, 'index.html');
    const safe = path.resolve(target);
    if (!safe.startsWith(directory)) throw new Error('Invalid path');
    const finalInfo = await stat(safe).catch(() => null);
    if (!finalInfo?.isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'content-type': types[path.extname(safe).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    createReadStream(safe).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : 'Server error');
  }
}).listen(port, '0.0.0.0', () => console.log(`Saanjh showcase: http://localhost:${port}`));
