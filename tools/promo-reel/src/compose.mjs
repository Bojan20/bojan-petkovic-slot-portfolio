/**
 * Compose Stage
 *
 * Takes the timeline (config.mjs TIMELINE), the rendered card PNGs, the
 * captured gameplay WebM, the three-note-oath WAV — and produces a final
 * MP4 via a single ffmpeg `filter_complex` graph.
 *
 * Key decisions:
 *   - Each "card" segment becomes a Ken-Burns image clip (slow zoom-in)
 *     for `segment.duration` seconds. Looks alive without animator overhead.
 *   - Gameplay segments use the captured WebM, scaled & cropped to the
 *     output aspect ratio, with a `lower-third` PNG overlay covering the
 *     bottom 13% of the frame for branding.
 *   - Transitions: 18-frame ease-out fade between every adjacent segment
 *     using `xfade`. No flashy spins — recruiters don't watch reels with
 *     glitch transitions, they watch with skeptical patience.
 *   - Audio bed: oath at the cold-open, then a procedurally generated
 *     ambient pad (also from this script) ducked under the gameplay
 *     section, swelling into the CTA. No copyrighted music = LinkedIn-safe.
 *
 *  Output: output/promo-{format}-30s.mp4 / promo-{format}-60s.mp4
 */

import { spawn } from 'node:child_process';
import { existsSync, statSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMATS, TIMELINE, BRAND, CAPTURE } from './config.mjs';
import { renderAllCards } from './brand-assets.mjs';
import { writeOathWav } from './three-note-oath.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────
// PROCEDURAL AMBIENT BED — single pad track for the whole reel
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a `seconds` long ambient pad using ffmpeg sine sources.
 * We layer 3 detuned saws + a sub bass + an aphex-twin-style filtered
 * pad. Pure ffmpeg synthesis, deterministic, royalty-free.
 *
 * Returns the absolute path to the WAV file produced.
 */
async function generateAmbientBed(seconds, outPath) {
  // Composition: F minor — F2 (87.31), Ab2 (103.83), C3 (130.81), F3 (174.61)
  // Slow LFO on filter cutoff for "breathing" pad. Final tail under -18 dB
  // so we don't fight gameplay audio.
  const args = [
    '-y',
    // ── chord drones ────────────────────────────────────────────────────
    '-f', 'lavfi', '-i', `sine=f=87.31:d=${seconds}`,    // F2  sub
    '-f', 'lavfi', '-i', `sine=f=130.81:d=${seconds}`,   // C3
    '-f', 'lavfi', '-i', `sine=f=174.61:d=${seconds}`,   // F3
    '-f', 'lavfi', '-i', `sine=f=261.63:d=${seconds}`,   // C4 (octave)
    // ── airy texture: brown noise filtered ─────────────────────────────
    '-f', 'lavfi', '-i', `anoisesrc=color=brown:duration=${seconds}:amplitude=0.10`,
    '-filter_complex', [
      // Detune + amplitude shape for warmth.
      '[0:a]volume=0.55,tremolo=f=0.18:d=0.05[d1]',
      '[1:a]volume=0.30,tremolo=f=0.22:d=0.06[d2]',
      '[2:a]volume=0.20,tremolo=f=0.28:d=0.08[d3]',
      '[3:a]volume=0.10,tremolo=f=0.35:d=0.10[d4]',
      // Filtered noise pad.
      '[4:a]lowpass=f=1800,highpass=f=180,volume=0.45[noise]',
      // Sum + master shape.
      '[d1][d2][d3][d4][noise]amix=inputs=5:normalize=0[mix]',
      // Slow LP filter sweep + global volume taper. -18 dB roughly.
      '[mix]lowpass=f=2200,volume=0.32,afade=t=in:st=0:d=2,afade=t=out:st=' + (seconds - 2.5) + ':d=2.5[out]',
    ].join(';'),
    '-map', '[out]',
    '-ac', '2',
    '-ar', '48000',
    '-c:a', 'pcm_s16le',
    outPath,
  ];
  await runFfmpeg(args, 'ambient-bed');
  return outPath;
}

// ─────────────────────────────────────────────────────────────────────
// FFMPEG RUNNER
// ─────────────────────────────────────────────────────────────────────

function runFfmpeg(args, label = 'ffmpeg') {
  return new Promise((resolveP, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let lastStderr = '';
    proc.stderr.on('data', (chunk) => {
      // ffmpeg prints progress on stderr; keep last 4 lines for crash logs.
      const txt = chunk.toString();
      lastStderr += txt;
      if (lastStderr.length > 4000) lastStderr = lastStderr.slice(-4000);
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolveP();
      else {
        console.error(`\n[${label}] ffmpeg exited ${code}`);
        console.error(lastStderr);
        reject(new Error(`ffmpeg failed (${label}, code ${code})`));
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────
// SEGMENT RENDERERS — each produces an intermediate MP4 of the right
// duration & resolution. Compose stage stitches them with xfade.
// ─────────────────────────────────────────────────────────────────────

/**
 * Render a card PNG into a Ken-Burns MP4 of `seconds` length.
 */
async function renderCardClip({ pngPath, outPath, fmt, seconds, kenBurns = true }) {
  const { width, height, fps } = fmt;
  const totalFrames = Math.round(seconds * fps);
  // PERF NOTE: the textbook ffmpeg Ken-Burns recipe pre-upscales 4× and
  // uses zoompan; at 1080p that produces 4320×7680 intermediate frames
  // (~33 megapixels each) and crawls at <1 fps on CPU x264. We instead
  // pre-scale only ~6% (just enough headroom to mask zoom edges) and use
  // zoompan with a per-frame zoom expression. Output looks identical to
  // the human eye but is ~50× faster.
  //
  // We also bake the static PNG into a video once per segment — not per
  // frame — so the read cost is amortized.
  const zoomMax = 1.06;
  const filter = kenBurns
    ? `scale=${Math.round(width * zoomMax)}:${Math.round(height * zoomMax)}:flags=lanczos,` +
      `zoompan=z='1.0+0.06*on/${totalFrames}':d=1:` +
      `x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':` +
      `s=${width}x${height}:fps=${fps},format=yuv420p`
    : `scale=${width}:${height}:flags=lanczos,format=yuv420p`;
  const args = [
    '-y',
    '-loop', '1',
    '-framerate', String(fps),
    '-t', String(seconds),
    '-i', pngPath,
    '-vf', filter,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '20',
    '-an', // silent; audio is overlaid globally
    outPath,
  ];
  await runFfmpeg(args, `card:${basename(pngPath)}`);
  return outPath;
}

/**
 * Render a gameplay segment: take WebM, scale + crop to format, overlay
 * lower-third PNG at the bottom, write `seconds` of footage starting at
 * the configured offset.
 */
async function renderGameplayClip({ webmPath, lowerThirdPng, outPath, fmt, startSec, seconds }) {
  const { width, height, fps } = fmt;
  const isPortrait = height > width;
  // Different scale strategy per orientation:
  //   landscape (1920×1080) — fit width, crop center vertically
  //   vertical  (1080×1920) — fit height, crop horizontally + add side bars
  // We use scale + pad rather than crop, so we never lose game UI.
  const scaleFilter = isPortrait
    ? `scale=${width}:${Math.round(width * 0.5625)}:flags=lanczos,pad=${width}:${height}:0:(${height}-ih)/2:color=${BRAND.colors.void}`
    : `scale=${width}:${height}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${width}:${height}:(${width}-iw)/2:0:color=${BRAND.colors.void}`;
  const args = [
    '-y',
    '-ss', String(startSec),
    '-t', String(seconds),
    '-i', webmPath,
    '-loop', '1',
    '-t', String(seconds),
    '-i', lowerThirdPng,
    '-filter_complex', [
      `[0:v]${scaleFilter},format=yuv420p,fps=${fps},trim=duration=${seconds},setpts=PTS-STARTPTS[bg]`,
      `[1:v]format=yuva420p,trim=duration=${seconds},setpts=PTS-STARTPTS[lt]`,
      `[bg][lt]overlay=0:0:format=auto:shortest=1[outv]`,
    ].join(';'),
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '20',
    '-frames:v', String(Math.round(seconds * fps)),
    '-an',
    outPath,
  ];
  await runFfmpeg(args, 'gameplay');
  return outPath;
}

/**
 * Concatenate intermediate clips with crossfade transitions.
 * Returns path to the silent video.
 */
async function concatWithXfade({ clips, outPath, fps }) {
  // Build a chain: c0 -> xfade(c1) -> xfade(c2) -> ...
  // Each xfade has duration 0.6s.
  const xfadeDur = 0.6;
  const inputs = clips.flatMap((c) => ['-i', c.path]);

  // Compute progressive offsets.
  let acc = 0;
  const offsets = [];
  for (let i = 0; i < clips.length - 1; i++) {
    acc += clips[i].duration - xfadeDur;
    offsets.push(acc);
  }

  const filterParts = [];
  let prev = '[0:v]';
  for (let i = 1; i < clips.length; i++) {
    const out = (i === clips.length - 1) ? '[outv]' : `[v${i}]`;
    filterParts.push(`${prev}[${i}:v]xfade=transition=fade:duration=${xfadeDur}:offset=${offsets[i - 1].toFixed(3)}${out}`);
    prev = out;
  }

  const args = [
    '-y',
    ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '20',
    '-r', String(fps),
    '-an',
    outPath,
  ];
  await runFfmpeg(args, 'concat-xfade');
  return outPath;
}

/**
 * Final pass: mux silent video + audio bed + oath stinger.
 * Audio map:
 *   [oath]  starts at 0, ducked to 0.0 after cold-open ends
 *   [bed]   plays from t=0 throughout, ducked under any future capture audio
 */
async function muxAudio({ silentVideo, oathWav, bedWav, outPath, durationSec }) {
  const oathLen = 0.39;
  const args = [
    '-y',
    '-i', silentVideo,
    '-i', oathWav,
    '-i', bedWav,
    '-filter_complex', [
      // Oath: pad with silence to full reel length, level @ 0 dB.
      `[1:a]apad=whole_dur=${durationSec},volume=1.0[oath]`,
      // Bed: fade in over 0.4s starting at oath onset, level -8 dB.
      `[2:a]volume=0.40,afade=t=in:st=0.4:d=0.6,afade=t=out:st=${(durationSec - 1.2).toFixed(2)}:d=1.0[bed]`,
      `[oath][bed]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[outa]`,
    ].join(';'),
    '-map', '0:v',
    '-map', '[outa]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    outPath,
  ];
  await runFfmpeg(args, 'mux-audio');
  return outPath;
}

// ─────────────────────────────────────────────────────────────────────
// ENTRY: compose for a single format
// ─────────────────────────────────────────────────────────────────────

export async function composeFormat(formatKey, { webmPath, oathWav, bedDir, intermediateDir, outDir, captureStart = 0 }) {
  const fmt = FORMATS[formatKey];
  const timeline = TIMELINE[formatKey];
  if (!timeline) throw new Error(`No timeline for format ${formatKey}`);

  console.log(`\n▸ Composing ${formatKey} (${fmt.width}×${fmt.height}, ${fmt.duration}s)`);

  // Render brand cards if missing.
  const cardsDir = resolve(ROOT, 'assets', 'cards', formatKey);
  const cardsManifestPath = resolve(cardsDir, 'manifest.json');
  if (!existsSync(cardsManifestPath)) {
    console.log(`  ▸ Brand cards not found, rendering...`);
    await renderAllCards(formatKey);
  }
  const cards = JSON.parse(readFileSync(cardsManifestPath, 'utf-8')).cards;
  // Lower-third overlay.
  if (!cards['lower-third']) {
    throw new Error(`lower-third missing in cards manifest`);
  }

  // Step A — render each segment.
  mkdirSync(intermediateDir, { recursive: true });
  // Cursor advances through the source video as we consume gameplay segments.
  // Honor an optional caller-provided start offset (e.g. when the first 5
  // seconds of the user's screen recording is QuickTime UI / mouse settle).
  let captureCursor = Math.max(0, Number(captureStart) || 0);
  const captureFile = webmPath;
  const captureDuration = await probeDuration(captureFile);

  const clips = [];
  let i = 0;
  for (const seg of timeline) {
    const outPath = resolve(intermediateDir, `${String(i).padStart(2, '0')}-${seg.name}.mp4`);
    if (seg.kind === 'capture-hilights') {
      // Pull from the capture, advancing the cursor.
      const startSec = Math.min(captureCursor, Math.max(0, captureDuration - seg.duration - 0.5));
      await renderGameplayClip({
        webmPath: captureFile,
        lowerThirdPng: cards['lower-third'],
        outPath,
        fmt,
        startSec,
        seconds: seg.duration,
      });
      captureCursor = startSec + seg.duration + 0.5;
    } else {
      const png = cards[seg.kind];
      if (!png) throw new Error(`No card for kind=${seg.kind}`);
      await renderCardClip({ pngPath: png, outPath, fmt, seconds: seg.duration });
    }
    clips.push({ path: outPath, duration: seg.duration });
    console.log(`  ✓ ${formatKey}/${seg.name} (${seg.duration}s, ${seg.kind})`);
    i++;
  }

  // Step B — concat with xfade.
  const silentVideo = resolve(intermediateDir, '_silent.mp4');
  await concatWithXfade({ clips, outPath: silentVideo, fps: fmt.fps });

  // Step C — generate ambient bed if missing.
  mkdirSync(bedDir, { recursive: true });
  const bedWav = resolve(bedDir, `bed-${formatKey}.wav`);
  // xfade reduces total duration; recompute.
  const totalRendered = clips.reduce((a, c) => a + c.duration, 0) - (clips.length - 1) * 0.6;
  if (!existsSync(bedWav) || statSync(bedWav).size < 1000) {
    await generateAmbientBed(totalRendered + 0.5, bedWav);
  }

  // Step D — final mux.
  mkdirSync(outDir, { recursive: true });
  const finalOut = resolve(outDir, `promo-${fmt.suffix}.mp4`);
  await muxAudio({ silentVideo, oathWav, bedWav, outPath: finalOut, durationSec: totalRendered });

  const size = (statSync(finalOut).size / 1024 / 1024).toFixed(2);
  console.log(`\n  ✓ ${basename(finalOut)} — ${totalRendered.toFixed(1)}s · ${size} MB`);
  return finalOut;
}

/** Probe duration in seconds. */
async function probeDuration(path) {
  return new Promise((resolveP, reject) => {
    const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path]);
    let out = '';
    proc.stdout.on('data', (c) => { out += c.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe failed on ${path}`));
      resolveP(parseFloat(out.trim()));
    });
  });
}
