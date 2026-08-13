#!/usr/bin/env node
/**
 * A dependency-free static server for examples/, which load the widget from
 * ../dist/. Two of the pages use <script type="module">, which browsers refuse
 * to load over file://, so opening the HTML directly does not work.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 5000);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  const requested = url.pathname === '/' ? '/examples/' : url.pathname;

  // Resolve inside root only — a static server should never serve ../../etc.
  let target = path.resolve(root, `.${requested}`);
  if (!target.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
  } catch {
    // fall through to the read error below
  }

  try {
    const body = await readFile(target);
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[path.extname(target)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response
      .writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
      .end(
        `<h1>404</h1><p>No such file: ${requested}</p><p>Try <a href="/examples/">/examples/</a>.</p>`
      );
  }
});

server.listen(port, () => {
  console.log(`\n  Examples: http://localhost:${port}/examples/\n`);
  console.log('  cdn-umd.html          — UMD global + push queue');
  console.log('  custom-element.html   — <ss-chat> driven by the DOM');
  console.log('  esm-streaming.html    — createChatbot + streamed reply\n');
  console.log('  (run `npm run build` first — these pages load from ../dist/)\n');
});
