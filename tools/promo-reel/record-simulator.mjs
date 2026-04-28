#!/usr/bin/env node
/**
 * record-simulator.mjs — Autonomous promo reel generator
 * Opens slot-simulator.html in headless Chromium, records the full
 * 7-phase sequence (45s), then runs ffmpeg post-processing:
 *   • WebM → H.264 MP4
 *   • Synthesised western-ambient audio bed
 *   • Gold brand bars top + bottom
 *   • Fade-in / fade-out
 *   • Final output: output/promo-reel-final.mp4
 *
 * Usage:  node record-simulator.mjs
 *         npm run simulate          (from tools/promo-reel/)
 */

import { chromium } from './node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, readdirSync } from 'fs';

/* ─── Paths ──────────────────────────────────────────────────── */
const __dir   = dirname(fileURLToPath(import.meta.url));
const SIM     = resolve(__dir, 'slot-simulator.html');
const OUT     = join(__dir, 'output');
const TMP     = join(__dir, 'output', '_tmp');
const RAW_MP4 = join(TMP,  'raw.mp4');
const AUD_MP4 = join(TMP,  'audio.mp4');
const FINAL   = join(OUT,  'promo-reel-final.mp4');

/* ─── Sequence duration (ms) ─────────────────────────────────── */
// Calculated from slot-simulator.html waits + stagger + spinCol timings:
//   INTRO 5.6s + BASE_GAME 6.1s + SCATTER 4.3s + FS_BANNER 0.8s
//   + FREE_SPINS 7.7s + BIG_WIN_SPIN 1.6s + BIG_WIN 7.5s + OUTRO 6s
// Total ≈ 39.6s — give 6s buffer for animation settling
const SEQ_MS = 46_000;

/* ─── Helper: run shell command ──────────────────────────────── */
function sh(cmd, label = '') {
  if (label) process.stdout.write(`   ${label}... `);
  const r = spawnSync(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) {
    if (label) console.log('FAIL');
    console.error('\n❌ Command failed:', cmd);
    console.error(r.stderr?.toString().slice(0, 800));
    process.exit(1);
  }
  if (label) console.log('OK');
  return r.stdout?.toString().trim();
}

/* ─── Main ───────────────────────────────────────────────────── */
console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║  PROMO REEL GENERATOR — Bojan Petković           ║');
console.log('║  Cash Eruption: The Western  ·  Audio Director   ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');

// Setup dirs
[OUT, TMP].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

/* ── STEP 1: Playwright headless recording ─────────────────── */
console.log('📷  STEP 1 — Recording simulator in headless Chromium...');
console.log(`    File  : ${SIM}`);
console.log(`    Length: ${SEQ_MS / 1000}s`);
console.log('');

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-gl-drawing-for-tests',
    '--window-size=1280,720',
  ],
});

const tmpVideoDir = join(TMP, 'pw');
if (!existsSync(tmpVideoDir)) mkdirSync(tmpVideoDir, { recursive: true });

const ctx = await browser.newContext({
  viewport:    { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: tmpVideoDir, size: { width: 1280, height: 720 } },
});

const page = await ctx.newPage();

// Silence console noise from the simulator page
page.on('console', () => {});
page.on('pageerror', () => {});

process.stdout.write('    Opening page... ');
await page.goto(`file://${SIM}`);
await page.waitForLoadState('domcontentloaded');
console.log('loaded');

process.stdout.write('    Waiting for sequence to complete');
const ticker = setInterval(() => process.stdout.write('.'), 2000);
await page.waitForTimeout(SEQ_MS);
clearInterval(ticker);
console.log(' done');

process.stdout.write('    Finalising video... ');
const pwWebm = await page.video().path();
await page.close();
await ctx.close();
await browser.close();
console.log('saved');
console.log(`    Raw WebM: ${pwWebm}`);
console.log('');

/* ── STEP 2: WebM → MP4 ────────────────────────────────────── */
console.log('🎞️   STEP 2 — Converting WebM → MP4...');
sh(
  `ffmpeg -y -i "${pwWebm}" -c:v libx264 -preset fast -crf 16 -pix_fmt yuv420p "${RAW_MP4}"`,
  'encode'
);
console.log('');

/* ── STEP 3: Synthesise western-ambient audio bed ──────────── */
console.log('🎵  STEP 3 — Synthesising audio bed...');
// Layered analogue-style ambient:
//   A2 (110Hz) tonic drone  — deep warmth
//   E3 (165Hz) perfect fifth — opens the space
//   A3 (220Hz) octave        — shimmer
//   C#3 (138Hz) major third  — western major feel
//   Gentle LFO tremolo on each harmonic (0.3–0.7 Hz)
// Volume envelope: 2s fade-in, sustain, 3s fade-out
const dur = SEQ_MS / 1000;
const audioExpr = [
  `0.12*sin(2*PI*110*t)*(0.5+0.5*sin(2*PI*0.4*t))`,
  `0.07*sin(2*PI*165*t)*(0.5+0.5*sin(2*PI*0.33*t+0.8))`,
  `0.05*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.55*t+1.2))`,
  `0.04*sin(2*PI*138.6*t)*(0.5+0.5*sin(2*PI*0.25*t+0.4))`,
  `0.03*sin(2*PI*277*t)*(0.5+0.5*sin(2*PI*0.6*t+2.1))`,
].join('+');

sh(
  `ffmpeg -y \
    -f lavfi -i "aevalsrc=${audioExpr}:s=44100:c=stereo:d=${dur}" \
    -af "afade=in:st=0:d=2,afade=out:st=${dur - 3}:d=3,volume=0.7" \
    -c:a aac -b:a 128k \
    "${TMP}/amb.aac"`,
  'synthesise'
);
console.log('');

/* ── STEP 4: Mux video + audio ─────────────────────────────── */
console.log('🔊  STEP 4 — Muxing video + audio...');
sh(
  `ffmpeg -y \
    -i "${RAW_MP4}" \
    -i "${TMP}/amb.aac" \
    -map 0:v -map 1:a \
    -c:v copy -c:a aac -b:a 128k \
    -shortest "${AUD_MP4}"`,
  'mux'
);
console.log('');

/* ── STEP 5: Brand pass — gold bars + fade in/out ──────────── */
console.log('✨  STEP 5 — Applying brand pass...');
// Gold bars: 3px top, 3px bottom
// Fade-in: 0→1s, Fade-out: last 1.5s
const videDur = sh(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${AUD_MP4}"`);
const fade_out_start = parseFloat(videDur) - 1.5;

sh(
  `ffmpeg -y \
    -i "${AUD_MP4}" \
    -vf "drawbox=x=0:y=0:w=iw:h=3:color=#d4a843@1.0:t=fill, \
         drawbox=x=0:y=ih-3:w=iw:h=3:color=#d4a843@1.0:t=fill, \
         fade=in:st=0:d=1, \
         fade=out:st=${fade_out_start.toFixed(2)}:d=1.5" \
    -af "afade=in:st=0:d=1,afade=out:st=${(parseFloat(videDur)-1.5).toFixed(2)}:d=1.5" \
    -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p \
    -c:a aac -b:a 192k \
    -movflags +faststart \
    "${FINAL}"`,
  'brand'
);
console.log('');

/* ── STEP 6: Cleanup tmp ───────────────────────────────────── */
console.log('🧹  Cleaning temp files...');
try { rmSync(TMP, { recursive: true, force: true }); } catch {}
console.log('');

/* ── Done ──────────────────────────────────────────────────── */
const finalSize = sh(`du -sh "${FINAL}" | cut -f1`);
const finalDur  = sh(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${FINAL}"`);

console.log('╔══════════════════════════════════════════════════╗');
console.log('║  ✅  PROMO REEL COMPLETE                         ║');
console.log('╠══════════════════════════════════════════════════╣');
console.log(`║  File : promo-reel-final.mp4                     ║`);
console.log(`║  Size : ${(finalSize + '                   ').slice(0, 9)}                            ║`);
console.log(`║  Dur  : ${(parseFloat(finalDur).toFixed(1) + 's             ').slice(0, 9)}                            ║`);
console.log('╠══════════════════════════════════════════════════╣');
console.log('║  Pipeline:                                       ║');
console.log('║   Playwright headless → WebM                     ║');
console.log('║   ffmpeg WebM → H.264 MP4                        ║');
console.log('║   Synthesised western ambient audio bed           ║');
console.log('║   Gold brand bars + fade in/out                  ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');
console.log(`   📁  ${FINAL}`);
console.log('');
