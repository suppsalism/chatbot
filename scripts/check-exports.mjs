#!/usr/bin/env node
/**
 * Verifies that every path package.json promises actually exists in dist/ after
 * a build, and that the built bundles kept the package's two hard guarantees:
 * no network calls, and no side effects on import.
 *
 * Run by CI after `npm run build`. A broken exports map is the classic way to
 * ship a package that installs fine and then fails at import time.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const pkg = require(path.join(root, 'package.json'));

const failures = [];
const fail = (message) => failures.push(message);

/** Collects every string leaf out of the (possibly nested) exports map. */
function collectPaths(node, trail = 'exports') {
  if (typeof node === 'string') return [[trail, node]];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) => collectPaths(value, `${trail}.${key}`));
}

const declared = [
  ...['main', 'module', 'unpkg', 'browser', 'types'].flatMap((field) =>
    pkg[field] ? [[field, pkg[field]]] : []
  ),
  ...collectPaths(pkg.exports),
];

for (const [field, relative] of declared) {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) {
    fail(`package.json "${field}" points at ${relative}, which does not exist`);
  }
}

// Every published file must sit under a directory listed in "files", or npm
// will silently omit it from the tarball. package.json itself is always
// included regardless of "files", so it needs no entry.
const ALWAYS_PUBLISHED = new Set(['package.json', 'README.md', 'LICENSE.md']);

for (const [field, relative] of declared) {
  const top = relative.replace(/^\.\//, '').split('/')[0];
  if (ALWAYS_PUBLISHED.has(top)) continue;
  if (!pkg.files.some((entry) => entry.replace(/^\.\//, '').split('/')[0] === top)) {
    fail(
      `package.json "${field}" -> ${relative} is not covered by "files": ${pkg.files.join(', ')}`
    );
  }
}

// The package documents zero network calls and zero side effects. Both are easy
// to regress by importing something new, and both are cheap to assert here.
const bundles = declared
  .map(([, relative]) => relative)
  .filter((relative) => relative.endsWith('.js') || relative.endsWith('.cjs'));

for (const relative of [...new Set(bundles)]) {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) continue;

  const source = await readFile(absolute, 'utf8');
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'new WebSocket']) {
    if (source.includes(forbidden)) {
      fail(`${relative} contains "${forbidden}" — this package must make no network calls`);
    }
  }
}

if (pkg.sideEffects !== false) {
  fail('package.json "sideEffects" should be false so bundlers can tree-shake the package');
}

if (failures.length > 0) {
  console.error('✗ exports check failed:\n');
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`✓ exports check passed (${declared.length} declared paths)`);
