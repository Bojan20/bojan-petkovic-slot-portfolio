#!/usr/bin/env node
/**
 * MAKE-REEL — single-command orchestrator
 *
 * Usage:
 *   npm run make                    # both formats (default)
 *   npm run make -- --format=vertical
 *   npm run make -- --format=landscape
 *   npm run make -- --format=both --skip-capture       # reuse existing webm
 *   npm run make -- --format=vertical --skip-cards     # reuse existing PNGs
 *
 * Stages (each idempotent — re-uses outputs unless --force):
 *   1. Three-Note Oath WAV   → assets/audio/three-note-oath.wav
 *   2. Brand cards (PNGs)    → assets/cards/{format}/*.png
 *   3. Capture (WebM)        → captures/raw-gameplay.webm
 *   4. Compose (per-format)  → output/promo-{format}-{N}s.mp4
 *
 * Exit code: 0 on full success, 1 if any format failed.
 */

import { existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMATS, CAPTURE } from './config.mjs';
import { renderAllCards } from './brand-assets.mjs';
import { capture as runCapture } from './capture.mjs';
import { composeFormat } from './compose.mjs';
import { writeOathWav } from './three-note-oath.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ── argv parsing ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    format: 'both',
    skipCapture: false,
    skipCards: false,
    skipOath: false,
    force: false,
  };
  for (const a of argv) {
    if (a === '--skip-capture') opts.skipCapture = true;
    else if (a === '--skip-cards') opts.skipCards = true;
    else if (a === '--skip-oath') opts.skipOath = true;
    else if (a === '--force') opts.force = true;
    else if (a.startsWith('--format=')) opts.format = a.split('=')[1];
  }
  if (!['vertical', 'landscape', 'both'].includes(opts.format)) {
    throw new Error(`Invalid --format=${opts.format} (vertical | landscape | both)`);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

// ── stage 1: three-note oath ────────────────────────────────────────────
const oathWav = resolve(ROOT, 'assets', 'audio', 'three-note-oath.wav');
if (opts.force || opts.skipOath !== true) {
  if (opts.force || !existsSync(oathWav) || statSync(oathWav).size < 1000) {
    console.log('▸ [1/4] Rendering Three-Note Oath (390ms signature)');
    writeOathWav(oathWav);
    console.log(`  ✓ ${oathWav}`);
  } else {
    console.log('▸ [1/4] Three-Note Oath cached, skipping');
  }
}

// ── stage 2: brand cards ────────────────────────────────────────────────
const targetFormats = opts.format === 'both' ? ['vertical', 'landscape'] : [opts.format];
if (!opts.skipCards) {
  for (const f of targetFormats) {
    const manifest = resolve(ROOT, 'assets', 'cards', f, 'manifest.json');
    if (!opts.force && existsSync(manifest)) {
      console.log(`▸ [2/4] Brand cards [${f}] cached, skipping`);
      continue;
    }
    console.log(`▸ [2/4] Rendering brand cards [${f}]`);
    await renderAllCards(f);
  }
}

// ── stage 3: capture ────────────────────────────────────────────────────
const webmPath = resolve(ROOT, CAPTURE.outputPath);
if (!opts.skipCapture) {
  if (!opts.force && existsSync(webmPath) && statSync(webmPath).size > 100_000) {
    console.log('▸ [3/4] Capture cached, skipping (use --force to re-record)');
  } else {
    console.log('▸ [3/4] Recording gameplay capture');
    await runCapture();
  }
} else if (!existsSync(webmPath)) {
  console.error(`✗ --skip-capture set but ${webmPath} does not exist`);
  process.exit(1);
}

// ── stage 4: compose per format ─────────────────────────────────────────
const intermediateDir = resolve(ROOT, 'output', '_intermediate');
const bedDir          = resolve(ROOT, 'assets', 'audio');
const outDir          = resolve(ROOT, 'output');
mkdirSync(outDir, { recursive: true });

let failures = 0;
const results = [];
for (const f of targetFormats) {
  console.log(`\n▸ [4/4] Compose ${f}`);
  try {
    const out = await composeFormat(f, {
      webmPath,
      oathWav,
      bedDir,
      intermediateDir: resolve(intermediateDir, f),
      outDir,
    });
    results.push({ format: f, path: out, ok: true });
  } catch (err) {
    console.error(`✗ Compose [${f}] failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    results.push({ format: f, ok: false, error: err.message });
    failures++;
  }
}

// ── summary ─────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  PROMO REEL — SUMMARY');
console.log('══════════════════════════════════════════════════════════════');
for (const r of results) {
  if (r.ok) console.log(`  ✓ ${r.format.padEnd(10)} → ${r.path}`);
  else      console.log(`  ✗ ${r.format.padEnd(10)} → ${r.error}`);
}
console.log('══════════════════════════════════════════════════════════════\n');

process.exit(failures ? 1 : 0);
