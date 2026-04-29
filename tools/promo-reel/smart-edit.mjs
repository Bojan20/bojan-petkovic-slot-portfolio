#!/usr/bin/env node
/**
 * smart-edit.mjs — 4K Autonomous Video Editor
 *
 * EYES:   scene detection · brightness (signalstats YAVG) · audio RMS
 * BRAIN:  BASE_GAME / TRIGGER / BIG_WIN classification + temporal heuristics
 * HANDS:  4K zoom-to-fill · hevc_videotoolbox 80Mbps · PIL 4K overlays
 *         clips encoded ONCE → concat copy (zero re-encode) → audio bed mux
 *         Outputs: 4K HEVC master + 1080p H.264 proxy
 *
 * stdout protocol: PROGRESS:<pct>:<label>  INFO:<msg>  DONE:<path>  ERROR:<msg>
 * Usage: node smart-edit.mjs <input> [--output=path.mp4]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const OUT    = resolve(__dir, 'output');
const TMP    = resolve(__dir, 'output', `_4k_${Date.now()}`);

const inputArg = process.argv[2];
if (!inputArg || !existsSync(resolve(inputArg))) {
  process.stdout.write(`ERROR:Input not found: ${inputArg ?? '(none)'}\n`); process.exit(1);
}
const INPUT   = resolve(inputArg);
const OUTPUT  = process.argv.find(a => a.startsWith('--output='))?.split('=').slice(1).join('=')
             ?? resolve(OUT, 'smart-reel-4k.mp4');
const PROXY   = OUTPUT.replace('.mp4', '-1080p.mp4');

[OUT, TMP].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

/* ── Log helpers ── */
const pr = (pct, label) => process.stdout.write(`PROGRESS:${pct}:${label}\n`);
const lg = msg           => process.stdout.write(`INFO:${msg}\n`);
function die(msg) {
  process.stdout.write(`ERROR:${msg}\n`);
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
  process.exit(1);
}

function ff(args, label = '') {
  const r = spawnSync('ffmpeg', ['-hide_banner', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
  });
  const out = (r.stdout?.toString() ?? '') + (r.stderr?.toString() ?? '');
  if (r.status !== 0) die(`ffmpeg [${label}] failed:\n${out.slice(-1000)}`);
  return out;
}
function ffA(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  return (r.stdout?.toString() ?? '') + (r.stderr?.toString() ?? '');
}
function probe(args) {
  const r = spawnSync('ffprobe', ['-hide_banner', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024,
  });
  return (r.stdout?.toString() ?? '') + (r.stderr?.toString() ?? '');
}
function python(script) {
  const r = spawnSync('python3', ['-c', script], {
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) die(`Python failed:\n${r.stderr?.toString().slice(-600)}`);
  return r.stdout?.toString()?.trim() ?? '';
}
function avg(arr, k) { return arr.length ? arr.reduce((s, x) => s + (k ? x[k] : x), 0) / arr.length : 0; }

/* ── Detect hardware encoder ── */
const VT_TEST = spawnSync('ffmpeg', ['-f','lavfi','-i','color=black:s=32x32:d=0.05','-c:v','hevc_videotoolbox','-b:v','1M','-f','null','-'], { stdio: 'ignore' });
const HAS_VT  = VT_TEST.status === 0;
lg(`Encoder: ${HAS_VT ? 'hevc_videotoolbox (hardware)' : 'libx265 (software)'}`);

// Video encoder args for 4K master clips
function masterEncoderArgs(fps = 30) {
  if (HAS_VT) return ['-c:v', 'hevc_videotoolbox', '-b:v', '80M', '-tag:v', 'hvc1', '-r', String(fps)];
  return ['-c:v', 'libx265', '-crf', '14', '-preset', 'medium', '-r', String(fps)];
}

/* ═══════════════════════════════════════════════════════════
   STEP 1 — PROBE
═══════════════════════════════════════════════════════════ */
pr(5, 'Probing source video');

const probeRaw = probe([
  '-v', 'error',
  '-show_entries', 'format=duration:stream=width,height,avg_frame_rate,r_frame_rate,codec_type,codec_name,color_transfer,color_space,pix_fmt',
  '-of', 'json', INPUT,
]);
let pj = {};
try { pj = JSON.parse(probeRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'); } catch {}

const duration   = parseFloat(pj.format?.duration ?? 60);
const vS         = pj.streams?.find(s => s.width) ?? {};
const srcW       = vS.width  ?? 1920;
const srcH       = vS.height ?? 1080;
const hasAudio   = !!(pj.streams?.find(s => s.codec_type === 'audio'));
const colorXfer  = vS.color_transfer ?? '';
const colorSpace = vS.color_space    ?? '';
const isHdr      = colorXfer.includes('smpte2084') || colorXfer.includes('hlg')
                || colorSpace.includes('bt2020') || srcW >= 3000;
const [fpN, fpD] = (vS.r_frame_rate ?? vS.avg_frame_rate ?? '30/1').split('/');
const srcFps     = Math.min(parseFloat(fpN) / parseFloat(fpD || 1), 60) || 30;
const outFps     = srcFps > 30 ? 60 : 30; // preserve high frame rate up to 60fps

lg(`Source: ${srcW}x${srcH} @ ${srcFps.toFixed(1)}fps | ${duration.toFixed(1)}s | HDR=${isHdr} | audio=${hasAudio}`);
lg(`Output: 3840x2160 @ ${outFps}fps | Encoder: ${HAS_VT ? 'hevc_videotoolbox 80M' : 'libx265 CRF-14'}`);

/* ═══════════════════════════════════════════════════════════
   STEP 2 — SCENE DETECTION
═══════════════════════════════════════════════════════════ */
pr(10, 'Detecting scene changes');
const maxRead = Math.min(duration, 90);
const scOut   = ffA(['-i',INPUT,'-t',maxRead.toString(),'-vf','select=gt(scene\\,0.18),showinfo','-an','-f','null','-']);
const sceneTimes = [...scOut.matchAll(/pts_time:([\d.]+)/g)]
  .map(m => parseFloat(m[1])).filter(t => !isNaN(t) && t > 0.5 && t < duration - 0.5);
lg(`${sceneTimes.length} scene changes`);

/* ═══════════════════════════════════════════════════════════
   STEP 3 — BRIGHTNESS (1fps signalstats)
═══════════════════════════════════════════════════════════ */
pr(18, 'Sampling frame brightness');
const lumaRaw = ffA(['-i',INPUT,'-t',maxRead.toString(),'-vf','fps=1,signalstats,metadata=print:key=lavfi.signalstats.YAVG','-an','-f','null','-']);
const lumaFrames = [];
let lT = 0;
for (const line of lumaRaw.split('\n')) {
  const tm = line.match(/pts_time:([\d.]+)/); if (tm) lT = parseFloat(tm[1]);
  const ym = line.match(/YAVG=([\d.]+)/);     if (ym) lumaFrames.push({ t: lT, y: parseFloat(ym[1]) });
}
lg(`${lumaFrames.length} brightness samples`);

/* ═══════════════════════════════════════════════════════════
   STEP 4 — AUDIO ENERGY
═══════════════════════════════════════════════════════════ */
pr(25, 'Sampling audio energy');
const audioFrames = [];
if (hasAudio) {
  const aRaw = ffA(['-i',INPUT,'-t',maxRead.toString(),'-vn','-af','astats=metadata=1:reset=44100,ametadata=print:key=lavfi.astats.Overall.RMS_level','-f','null','-']);
  let aT = 0;
  for (const line of aRaw.split('\n')) {
    const tm = line.match(/pts_time:([\d.]+)/); if (tm) aT = parseFloat(tm[1]);
    const rm = line.match(/RMS_level=(-?[\d.]+)/);
    if (rm) { const db = parseFloat(rm[1]); if (isFinite(db)) audioFrames.push({ t: aT, db }); }
  }
}
lg(`${audioFrames.length} audio samples`);

/* ═══════════════════════════════════════════════════════════
   STEP 5 — SEGMENT CLASSIFICATION
═══════════════════════════════════════════════════════════ */
pr(32, 'Classifying segments');

const bounds  = [0, ...sceneTimes, duration].sort((a, b) => a - b);
const deduped = [bounds[0]];
for (let x = 1; x < bounds.length; x++) {
  if (bounds[x] - deduped[deduped.length - 1] > 1.2) deduped.push(bounds[x]);
}
// Ensure at least 4 time splits for better selection
if (deduped.length < 4 && duration >= 16) {
  const step = duration / 4;
  for (let t = step; t < duration; t += step) {
    if (!deduped.some(d => Math.abs(d - t) < step * 0.4)) deduped.push(parseFloat(t.toFixed(2)));
  }
  deduped.sort((a, b) => a - b);
}

const segments = [];
for (let x = 0; x < deduped.length - 1; x++) {
  const start = deduped[x], end = Math.min(deduped[x+1], duration), len = end - start;
  if (len < 1.0) continue;
  const lw = lumaFrames.filter(f => f.t >= start && f.t < end);
  const aw = audioFrames.filter(f => f.t >= start && f.t < end);
  const avgL = avg(lw, 'y'), maxL = lw.length ? Math.max(...lw.map(f => f.y)) : 50;
  const lumaVar = lw.length > 1
    ? lw.reduce((acc, f) => acc + (f.y - avgL) ** 2, 0) / lw.length : 0;
  segments.push({ start, end, len, avgLuma: avgL, maxLuma: maxL, lumaVar, avgDb: avg(aw, 'db') || -40, type: 'BASE_GAME', score: 0 });
}
if (!segments.length) {
  const ch = duration / 3;
  for (let x = 0; x < 3; x++) segments.push({ start: x*ch, end: (x+1)*ch, len: ch, avgLuma: 50, maxLuma: 50, lumaVar: 0, avgDb: -30, type: 'BASE_GAME', score: 0 });
}

const mxL = Math.max(...segments.map(s => s.maxLuma), 1);
const mxV = Math.max(...segments.map(s => s.lumaVar), 1);
const mnD = Math.min(...segments.map(s => s.avgDb));
const mxD = Math.max(...segments.map(s => s.avgDb));
const dR  = Math.max(mxD - mnD, 1);

// Skip first 3s (UI/loading) for selection only
const MIN_START = 3.0;

for (const s of segments) {
  const nL   = s.maxLuma / mxL;
  const nV   = s.lumaVar / mxV;
  const nA   = (s.avgDb - mnD) / dR;
  const time = Math.max(s.start, 0) / duration; // temporal position 0→1

  // Score: brightness + variance (action) + audio + temporal position
  s.score = nL * 0.35 + nV * 0.25 + nA * 0.20 + time * 0.20;

  // Classification with audio priority, then temporal fallback
  if (hasAudio && nA > 0.7 && nL > 0.5) { s.type = 'BIG_WIN'; }
  else if (hasAudio && nA > 0.5 && nV > 0.5) { s.type = 'TRIGGER'; }
  else if (time > 0.68 && nL > 0.45 && s.start >= MIN_START) { s.type = 'BIG_WIN'; }
  else if (time > 0.38 && nV > 0.45 && s.start >= MIN_START) { s.type = 'TRIGGER'; }
  else { s.type = 'BASE_GAME'; }

  lg(`${s.type.padEnd(10)} ${s.start.toFixed(1)}-${s.end.toFixed(1)}s luma=${s.maxLuma.toFixed(0)} var=${s.lumaVar.toFixed(0)} score=${s.score.toFixed(2)}`);
}

// Select best non-overlapping clips
const validSegs = segments.filter(s => s.start >= MIN_START || s.end > MIN_START + 2);
const allSegs   = validSegs.length >= 2 ? validSegs : segments;

const bigWinPool  = allSegs.filter(s => s.type === 'BIG_WIN').sort((a, b) => b.score - a.score);
const triggerPool = allSegs.filter(s => s.type === 'TRIGGER').sort((a, b) => b.score - a.score);
const basePool    = allSegs.filter(s => s.type === 'BASE_GAME' && s.len >= 3).sort((a, b) => a.start - b.start);

// Ensure no duplicate segments
if (!bigWinPool.length) {
  const b = [...allSegs].sort((a, b) => b.score - a.score).find(s => s !== basePool[0]);
  if (b) { b.type = 'BIG_WIN'; bigWinPool.push(b); }
  else if (allSegs.length > 1) { const last = allSegs[allSegs.length - 1]; last.type = 'BIG_WIN'; bigWinPool.push(last); }
}
if (!basePool.length) {
  const b = allSegs.find(s => s !== bigWinPool[0] && s !== triggerPool[0]);
  if (b) { b.type = 'BASE_GAME'; basePool.push(b); }
  else if (allSegs[0]) { basePool.push(allSegs[0]); }
}

const CDUR = { BASE_GAME: 9, TRIGGER: 4, BIG_WIN: 11 };
const timeline = [];
if (basePool[0])    timeline.push({ ...basePool[0],    dur: Math.min(CDUR.BASE_GAME, basePool[0].len)    });
if (triggerPool[0]) timeline.push({ ...triggerPool[0], dur: Math.min(CDUR.TRIGGER,  triggerPool[0].len)  });
const bw = bigWinPool.find(s => !timeline.some(t => Math.abs(t.start - s.start) < 2));
if (bw)             timeline.push({ ...bw, dur: Math.min(CDUR.BIG_WIN, bw.len) });
if (!timeline.length) die('No usable segments');
lg(`Timeline: ${timeline.map(t => `${t.type}(${t.dur.toFixed(1)}s@${t.start.toFixed(1)}s)`).join(' → ')}`);

/* ═══════════════════════════════════════════════════════════
   STEP 6 — 4K PIL TEXT ASSETS
═══════════════════════════════════════════════════════════ */
pr(40, 'Generating 4K text overlays (PIL)');

const pilScript = `
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

TMP = ${JSON.stringify(TMP)}
W, H = 3840, 2160  # 4K UHD

def best_font(size):
    for path in [
        '/System/Library/Fonts/HelveticaNeue.ttc',
        '/System/Library/Fonts/Helvetica.ttc',
        '/Library/Fonts/Arial.ttf',
        '/System/Library/Fonts/SFNSDisplay.ttf',
        '/opt/homebrew/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]:
        if os.path.exists(path):
            try: return ImageFont.truetype(path, size)
            except: pass
    return ImageFont.load_default()

def txt_center_x(draw, text, y, font, fill, shadow=True, W=W):
    try: bb = font.getbbox(text); tw = bb[2] - bb[0]
    except: tw = len(text) * (font.size // 2 if hasattr(font,'size') else 24)
    x = (W - tw) // 2
    if shadow: draw.text((x+3, y+3), text, fill=(0,0,0), font=font)
    draw.text((x, y), text, fill=fill, font=font)

# ── 4K Lower Third  (3840 × 148px, RGBA) ──
LT_H = 148
lt = Image.new('RGBA', (W, LT_H), (0, 0, 0, 0))
ld = ImageDraw.Draw(lt)
ld.rectangle([0, 0, W, LT_H], fill=(0, 0, 0, 185))
ld.rectangle([0, 0, 5, LT_H], fill=(212, 168, 67, 230))  # gold stripe
ld.rectangle([0, LT_H-2, W, LT_H], fill=(212, 168, 67, 120))  # gold bottom line
f_name = best_font(56)
f_role = best_font(28)
f_cont = best_font(28)
ld.text((36, 18), 'BOJAN PETKOVIĆ', fill=(245, 208, 106), font=f_name)
ld.text((36, 95), 'AUDIO DIRECTOR  ·  iGAMING SPECIALIST  ·  8+ YRS  ·  50+ TITLES', fill=(34, 232, 255, 230), font=f_role)
contact = 'bojan@vanvinkl.com'
try: cw = f_cont.getbbox(contact)[2]
except: cw = len(contact) * 16
ld.text((W - cw - 40, 95), contact, fill=(255, 255, 255, 160), font=f_cont)
lt_path = os.path.join(TMP, '4k_lt.png')
lt.save(lt_path, 'PNG')

# ── Slate generator ──
def make_slate(name, lines, dur_tag=''):
    img = Image.new('RGB', (W, H), (6, 8, 20))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 8], fill=(212, 168, 67))
    d.rectangle([0, H-8, W, H], fill=(212, 168, 67))
    total_h = sum(ln['size'] + 16 for ln in lines)
    y = (H - total_h) // 2
    for ln in lines:
        f = best_font(ln['size'])
        txt_center_x(d, ln['text'], y, f, ln['color'])
        y += ln['size'] + 20
    p = os.path.join(TMP, name + '.png')
    img.save(p, 'PNG')
    return p

make_slate('4k_intro', [
    {'text': 'CASH ERUPTION: THE WESTERN',                    'size': 104, 'color': (212, 168, 67)},
    {'text': 'IGT  ·  2026  ·  Audio Director: Bojan Petković', 'size':  46, 'color': (160, 168, 192)},
])
make_slate('4k_base',    [{'text': 'BASE GAME',         'size': 140, 'color': (255, 255, 255)}])
make_slate('4k_trigger', [{'text': 'FEATURE TRIGGERED', 'size': 128, 'color': ( 34, 232, 255)}])
make_slate('4k_bigwin',  [{'text': 'BIG  WIN',          'size': 176, 'color': (255, 215,   0)}])
make_slate('4k_outro', [
    {'text': 'BOJAN PETKOVIĆ',                                         'size': 128, 'color': (245, 208, 106)},
    {'text': 'AUDIO DIRECTOR  ·  iGAMING  ·  8+ YRS  ·  50+ TITLES', 'size':  46, 'color': (204, 204, 204)},
    {'text': 'bojan@vanvinkl.com',                                     'size':  64, 'color': ( 34, 232, 255)},
])
print('PIL_OK:' + lt_path)
`;

const pilOut = python(pilScript);
const ltPng  = resolve(TMP, '4k_lt.png');
if (!existsSync(ltPng)) die('PIL failed to generate lower-third PNG');
lg(`PIL 4K assets ready`);

/* ═══════════════════════════════════════════════════════════
   STEP 7 — RENDER 4K GAMEPLAY CLIPS (encoded ONCE, hardware)
═══════════════════════════════════════════════════════════ */
pr(48, `Rendering ${timeline.length} clips at 4K`);

const TW = 3840, TH = 2160;
// Zoom-to-fill 4K (no black bars) with lanczos quality + optional HDR→SDR
const scaleZoom = `scale=${TW}:${TH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${TW}:${TH}`;
const colorConv = isHdr ? `,colorspace=bt709:iall=bt2020:fast=0` : '';
const baseVF    = scaleZoom + colorConv + `,format=yuv420p`;

// Accent top bar colours per type
const ACCENT = { BIG_WIN: '0xFFD700', TRIGGER: '0x22E8FF', BASE_GAME: '' };

const clipPaths = [];
for (let idx = 0; idx < timeline.length; idx++) {
  const seg  = timeline[idx];
  const fout = resolve(TMP, `clip4k-${idx}-${seg.type}.mp4`);
  clipPaths.push(fout);

  const accentF = seg.type !== 'BASE_GAME'
    ? `,drawbox=x=0:y=0:w=iw:h=10:color=${ACCENT[seg.type]}@0.95:t=fill` : '';

  const vf4k = [
    baseVF + accentF,
    `fade=t=in:st=0:d=0.5,fade=t=out:st=${(seg.dur-0.5).toFixed(2)}:d=0.5`,
  ].join(',');

  const aArgs = hasAudio
    ? ['-af', `afade=t=in:st=0:d=0.5,afade=t=out:st=${(seg.dur-0.5).toFixed(2)}:d=0.5`]
    : ['-an'];

  pr(48 + Math.round(idx / timeline.length * 20), `4K clip ${idx+1}/${timeline.length}: ${seg.type} @ ${seg.start.toFixed(1)}s`);

  // Two inputs: video + lower-third overlay
  ff([
    '-y',
    '-ss', seg.start.toFixed(3), '-i', INPUT, '-t', seg.dur.toFixed(3),
    '-loop', '1', '-i', ltPng,
    '-filter_complex',
    `[0:v]${vf4k}[vb];[1:v]scale=${TW}:148,format=rgba[lt];[vb][lt]overlay=0:H-148:shortest=1[vout]`,
    '-map', '[vout]',
    ...aArgs,
    ...masterEncoderArgs(outFps),
    '-c:a', 'aac', '-b:a', '256k',
    '-pix_fmt', 'yuv420p',
    fout,
  ], `clip4k-${idx}`);

  lg(`Clip ${idx+1} → ${(statSync(fout).size/1024/1024).toFixed(1)}MB`);
}

/* ═══════════════════════════════════════════════════════════
   STEP 8 — 4K SLATES (PNG → video, same encoder)
═══════════════════════════════════════════════════════════ */
pr(70, 'Generating 4K slates');

function pngToVid4k(pngPath, outPath, dur) {
  if (!existsSync(pngPath)) return null;
  const vf = `scale=${TW}:${TH},format=yuv420p,fade=t=in:st=0:d=0.45,fade=t=out:st=${(dur-0.45).toFixed(2)}:d=0.45`;
  ff([
    '-y', '-loop','1','-framerate', String(outFps), '-i', pngPath,
    '-t', dur.toString(),
    '-vf', vf,
    '-an',
    ...masterEncoderArgs(outFps),
    outPath,
  ], `slate-${outPath.split('/').pop()}`);
  return outPath;
}

const introVid   = pngToVid4k(resolve(TMP,'4k_intro.png'),   resolve(TMP,'sv4_intro.mp4'),   2.5);
const baseCard   = pngToVid4k(resolve(TMP,'4k_base.png'),    resolve(TMP,'sv4_base.mp4'),    1.0);
const trigCard   = pngToVid4k(resolve(TMP,'4k_trigger.png'), resolve(TMP,'sv4_trigger.mp4'), 1.0);
const bigWinCard = pngToVid4k(resolve(TMP,'4k_bigwin.png'),  resolve(TMP,'sv4_bigwin.mp4'),  1.0);
const outroVid   = pngToVid4k(resolve(TMP,'4k_outro.png'),   resolve(TMP,'sv4_outro.mp4'),   4.0);

/* ═══════════════════════════════════════════════════════════
   STEP 9 — CONCAT (stream copy — zero video re-encode)
═══════════════════════════════════════════════════════════ */
pr(80, 'Assembling reel (stream copy)');

const allClips = [];
if (introVid) allClips.push(introVid);
for (let idx = 0; idx < timeline.length; idx++) {
  const t = timeline[idx];
  if (t.type === 'BASE_GAME' && baseCard)   allClips.push(baseCard);
  if (t.type === 'TRIGGER'   && trigCard)   allClips.push(trigCard);
  if (t.type === 'BIG_WIN'   && bigWinCard) allClips.push(bigWinCard);
  allClips.push(clipPaths[idx]);
}
if (outroVid) allClips.push(outroVid);

const listPath = resolve(TMP, 'concat.txt');
writeFileSync(listPath, allClips.filter(existsSync).map(p => `file '${p}'`).join('\n') + '\n');

const concatPath = resolve(TMP, 'concat4k.mp4');
ff([
  '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
  '-c:v', 'copy',          // ← ZERO video re-encode
  '-c:a', 'aac', '-b:a', '256k',
  concatPath,
], 'concat-copy');

/* ═══════════════════════════════════════════════════════════
   STEP 10 — AUDIO BED + FINAL MASTER
═══════════════════════════════════════════════════════════ */
pr(88, 'Mixing audio bed');

const tdRaw   = probe(['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',concatPath]);
const totalDur = parseFloat(tdRaw.match(/([\d.]+)/)?.[1] ?? '30');

const bedPath = resolve(TMP, 'bed4k.aac');
const aEx = [
  `0.09*sin(2*PI*110*t)*(0.5+0.5*sin(2*PI*0.28*t))`,
  `0.06*sin(2*PI*165*t)*(0.5+0.5*sin(2*PI*0.37*t+0.9))`,
  `0.05*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.48*t+1.6))`,
  `0.03*sin(2*PI*277*t)*(0.5+0.5*sin(2*PI*0.19*t+2.3))`,
  `0.02*sin(2*PI*440*t)*(0.5+0.5*sin(2*PI*0.55*t+3.1))`,
].join('+');

ff([
  '-y','-f','lavfi','-i',`aevalsrc=${aEx}:s=48000:c=stereo:d=${totalDur+1}`,
  '-af', `afade=in:st=0:d=2,afade=out:st=${(totalDur-2).toFixed(2)}:d=2,volume=0.20`,
  '-c:a','aac','-b:a','256k',
  bedPath,
], 'audio-bed');

pr(93, 'Final 4K master encode');
const audioFilter = hasAudio
  ? `[0:a]volume=0.82[ga];[1:a]volume=0.20[bed];[ga][bed]amix=inputs=2:duration=first:normalize=0[outa]`
  : `[1:a]volume=1.0[outa]`;

// 4K master
ff([
  '-y',
  '-i', concatPath, '-i', bedPath,
  '-filter_complex', audioFilter,
  '-map','0:v', '-map','[outa]',
  '-c:v', 'copy',         // video already encoded at 4K quality — just mux
  '-c:a','aac','-b:a','256k',
  '-movflags','+faststart',
  OUTPUT,
], '4k-master');

// 1080p proxy
pr(96, 'Generating 1080p proxy');
ff([
  '-y', '-i', OUTPUT,
  '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p',
  '-c:v','libx264','-crf','15','-preset','fast',
  '-c:a','copy',
  '-movflags','+faststart',
  PROXY,
], '1080p-proxy');

/* ═══════════════════════════════════════════════════════════
   DONE
═══════════════════════════════════════════════════════════ */
try { rmSync(TMP, { recursive: true, force: true }); } catch {}

const m4kMB  = (statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
const m1MB   = (statSync(PROXY).size  / 1024 / 1024).toFixed(1);
lg(`4K master: ${m4kMB}MB`);
lg(`1080p proxy: ${m1MB}MB`);
process.stdout.write(`DONE:${OUTPUT}\n`);
