import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

export function createStaticServer(root = defaultRoot) {
  async function resolve(pathname) {
    const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
    let target = join(root, clean);
    if (!target.startsWith(root)) return null;
    try {
      const info = await stat(target);
      if (info.isDirectory()) target = join(target, 'index.html');
    } catch (error) {
      return null;
    }
    return target;
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const target = await resolve(url.pathname);
    if (!target) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
      return;
    }
    try {
      const body = await readFile(target);
      response.writeHead(200, {
        'content-type': TYPES[extname(target)] || 'application/octet-stream',
        'cache-control': 'no-store',
        'service-worker-allowed': '/',
      });
      response.end(body);
    } catch (error) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
    }
  });
}

export function startStaticServer(port = 0, root = defaultRoot) {
  const server = createStaticServer(root);
  server.keepAliveTimeout = 200;
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const sockets = new Set();
      server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
      });
      resolve({
        port: server.address().port,
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () =>
          new Promise((done) => {
            for (const socket of sockets) socket.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 4173);
  const server = createStaticServer();
  server.listen(port, () => {
    process.stdout.write(`Tack Sharp on http://localhost:${port}/\n`);
  });
}
