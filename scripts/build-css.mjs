#!/usr/bin/env node
/**
 * Emits dist/chatbot.css — the standalone stylesheet behind the
 * `@suppsalismjs/chatbot/style.css` export.
 *
 * The runtime does not use this file: `--css inline` bakes the same CSS into
 * the JS bundles, because the widget injects it into an iframe document it
 * creates at runtime and so cannot rely on the host page loading a stylesheet.
 * This copy exists so that someone who wants to fork the styling has a real
 * file to start from, instead of extracting it from a bundle.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const SOURCES = [
  [
    'shell',
    'src/styles/shell.css',
    'injected into the HOST page — positions the launcher and the iframe',
  ],
  [
    'widget',
    'src/styles/widget.css',
    'injected into the IFRAME document — styles the panel itself',
  ],
];

const parts = [
  '/*!',
  ' * @suppsalismjs/chatbot — standalone stylesheet',
  ' *',
  ' * Reference copy. The shipped bundles inline this CSS, so importing this file',
  ' * changes nothing on its own; it is here to be forked. The two sections below',
  ' * are injected into two different documents and are not interchangeable.',
  ' */',
  '',
];

for (const [name, relative, note] of SOURCES) {
  const css = await readFile(path.join(root, relative), 'utf8');
  parts.push(`/* ── ${name}: ${note} ── */`, '', css.trim(), '');
}

const output = `${parts.join('\n')}\n`;

await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/chatbot.css'), output, 'utf8');

console.log(`✓ dist/chatbot.css (${(output.length / 1024).toFixed(1)} kB)`);
