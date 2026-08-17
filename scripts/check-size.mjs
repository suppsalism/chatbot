#!/usr/bin/env node
/**
 * Enforces a gzipped size budget on the built bundles.
 *
 * The README advertises a bundle-size badge and zero dependencies; both are
 * promises that only stay true if something fails loudly when they stop being
 * true. Raising a budget is a deliberate edit to this file, reviewed like any
 * other change.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');

/** kB, gzipped. */
const BUDGETS = {
  'dist/chatbot.modern.js': 13,
  'dist/chatbot.module.js': 16,
  'dist/chatbot.cjs': 16,
  'dist/chatbot.umd.js': 16,
};

let failed = false;
const rows = [];

for (const [relative, budget] of Object.entries(BUDGETS)) {
  const absolute = path.join(root, relative);

  if (!existsSync(absolute)) {
    console.error(`✗ ${relative} is missing — run \`npm run build\` first`);
    failed = true;
    continue;
  }

  const gzipped = gzipSync(await readFile(absolute)).length / 1000;
  const withinBudget = gzipped <= budget;
  if (!withinBudget) failed = true;

  rows.push({
    bundle: relative,
    'gzip kB': gzipped.toFixed(2),
    'budget kB': budget.toFixed(2),
    headroom: `${(((budget - gzipped) / budget) * 100).toFixed(0)}%`,
    ok: withinBudget ? '✓' : '✗',
  });
}

console.table(rows);

if (failed) {
  console.error(
    '\n✗ size check failed — shrink the change, or raise the budget in scripts/check-size.mjs'
  );
  process.exit(1);
}

console.log('✓ size check passed');
