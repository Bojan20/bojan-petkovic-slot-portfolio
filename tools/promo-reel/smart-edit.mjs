#!/usr/bin/env node
/**
 * smart-edit.mjs — Gameplay-FIRST autonomous video editor
 *
 * EYES:   scene detection + brightness sampling + audio RMS
 * BRAIN:  classify → BASE_GAME / TRIGGER / BIG_WIN
 * HANDS:  cut → PIL text overlays → ffmpeg assembly → MP4
 *
 * stdout protocol: PROGRESS:<pct>:<label>  INFO:<msg>  DONE:<path>  ERROR:<msg>
 * Usage: node smart-edit.mjs <input.mov> [--output=path.mp4]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT   = resolve(__dir, 'output');
const TMP   = resolve(__dir, 'output', `_st_${Date.now()}`);

const inputArg = process.argv[2];
if (!inputArg || !existsSync(resolve(inputArg))) {
  process.stdout.write(`ERROR:Input not found: ${inputArg ?? '(none)'}\n`); process.exit(1);
}
const INPUT  = resolve(inputArg);
const OUTPUT = process.argv.find(a => a.startsWith('--output='))?.split('=').slice(1).join('=')
            ?? resolve(OUT, 'smart-reel-final.mp4');

[OUT, TMP].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

/* ── Helpers ── */
const p = (pct, label) => process.stdout.write(`PROGRESS:${pct}:${label}\n`);
const i = msg           => process.stdout.write(`INFO:${msg}\n`);
function die(msg) {
  process.stdout.write(`ERROR:${msg}\n`);
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
  process.exit(1);
}
function ff(args, label) {
  const r = spawnSync('ffmpeg', ['-hide_banner', ...args], { stdio: ['ignore','pipe','pipe'], maxBuffer: 128*1024*1024 });
  const out = (r.stdout?.toString()??'') + (r.stderr?.toString()??'');
  if (r.status !== 0) die(`ffmpeg [${label}] failed:\n${out.slice(-800)}`);
  return out;
}
function ffA(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', ...args], { stdio: ['ignore','pipe','pipe'], maxBuffer: 64*1024*1024 });
  return (r.stdout?.toString()??'') + (r.stderr?.toString()??'');
}
function probe(args) {
  const r = spawnSync('ffprobe', ['-hide_banner', ...args], { stdio: ['ignore','pipe','pipe'], maxBuffer: 8*1024*1024 });
  return (r.stdout?.toString()??'') + (r.stderr?.toString()??'');
}
function python(script) {
  const r = spawnSync('python3', ['-c', script], { stdio: ['ignore','pipe','pipe'], maxBuffer: 4*1024*1024 });
  if (r.status !== 0) die(`Python error:\n${r.stderr?.toString().slice(-400)}`);
  return r.stdout?.toString()?.trim() ?? '';
}
function avg(arr, k) { return arr.length ? arr.reduce((s,x) => s+(k?x[k]:x),0)/arr.length : 0; }

/* ═══ STEP 1 — PROBE ═══════════════════════════════════════════ */
p(5, 'Probing source video');
const probeRaw = probe(['-v','error','-show_entries','format=duration:stream=width,height,avg_frame_rate,codec_type,color_transfer,color_space','-of','json',INPUT]);
let pj = {};
try { pj = JSON.parse(probeRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'); } catch {}

const duration  = parseFloat(pj.format?.duration ?? 60);
const vS        = pj.streams?.find(s => s.width) ?? {};
const srcW      = vS.width ?? 1920;
const srcH      = vS.height ?? 1080;
const hasAudio  = !!(pj.streams?.find(s => s.codec_type === 'audio'));
const isHdr     = (vS.color_transfer ?? '').includes('smpte2084')
               || (vS.color_space ?? '').includes('bt2020')
               || srcW >= 3000;
const maxRead   = Math.min(duration, 90);

i(`${srcW}x${srcH} | ${duration.toFixed(1)}s | HDR=${isHdr} | audio=${hasAudio}`);

/* ═══ STEP 2 — SCENE DETECTION ═════════════════════════════════ */
p(12, 'Detecting scene changes');
const sceneOut = ffA(['-i',INPUT,'-t',maxRead.toString(),'-vf','select=gt(scene\\,0.20),showinfo','-an','-f','null','-']);
const sceneTimes = [...sceneOut.matchAll(/pts_time:([\d.]+)/g)]
  .map(m=>parseFloat(m[1])).filter(t=>!isNaN(t)&&t>0.5&&t<duration-0.5);
i(`${sceneTimes.length} scene changes`);

/* ═══ STEP 3 — BRIGHTNESS SAMPLING ═════════════════════════════ */
p(22, 'Sampling frame brightness');
const lumaOut = ffA(['-i',INPUT,'-t',maxRead.toString(),'-vf','fps=1,signalstats,metadata=print:key=lavfi.signalstats.YAVG','-an','-f','null','-']);
const lumaFrames = [];
let lT = 0;
for (const line of lumaOut.split('\n')) {
  const tm = line.match(/pts_time:([\d.]+)/); if (tm) lT = parseFloat(tm[1]);
  const ym = line.match(/YAVG=([\d.]+)/); if (ym) lumaFrames.push({t:lT, y:parseFloat(ym[1])});
}
i(`${lumaFrames.length} brightness samples`);

/* ═══ STEP 4 — AUDIO ENERGY ════════════════════════════════════ */
p(32, 'Sampling audio energy');
const audioFrames = [];
if (hasAudio) {
  const aOut = ffA(['-i',INPUT,'-t',maxRead.toString(),'-vn','-af','astats=metadata=1:reset=44100,ametadata=print:key=lavfi.astats.Overall.RMS_level','-f','null','-']);
  let aT = 0;
  for (const line of aOut.split('\n')) {
    const tm = line.match(/pts_time:([\d.]+)/); if (tm) aT = parseFloat(tm[1]);
    const rm = line.match(/RMS_level=(-?[\d.]+)/);
    if (rm) { const db = parseFloat(rm[1]); if (isFinite(db)) audioFrames.push({t:aT, db}); }
  }
}
i(`${audioFrames.length} audio samples`);

/* ═══ STEP 5 — CLASSIFY SEGMENTS ═══════════════════════════════ */
p(40, 'Classifying segments');
const bounds = [0, ...sceneTimes, duration].sort((a,b)=>a-b);
const deduped = [bounds[0]];
for (let x=1; x<bounds.length; x++) if (bounds[x]-deduped[deduped.length-1]>1.2) deduped.push(bounds[x]);
// Fixed splits if no scene changes
if (deduped.length < 3 && duration >= 10) {
  const step = duration/4;
  for (let t=step; t<duration; t+=step) deduped.push(parseFloat(t.toFixed(2)));
  deduped.sort((a,b)=>a-b);
}

const segments = [];
for (let x=0; x<deduped.length-1; x++) {
  const start=deduped[x], end=Math.min(deduped[x+1],duration), len=end-start;
  if (len<1.0) continue;
  const lw = lumaFrames.filter(f=>f.t>=start&&f.t<end);
  const aw = audioFrames.filter(f=>f.t>=start&&f.t<end);
  segments.push({
    start, end, len,
    avgLuma: avg(lw,'y'), maxLuma: lw.length?Math.max(...lw.map(f=>f.y)):50,
    avgDb:   avg(aw,'db') || -40,
    type: 'BASE_GAME', score: 0,
  });
}
if (!segments.length) {
  const ch=duration/3;
  for (let x=0;x<3;x++) segments.push({start:x*ch,end:(x+1)*ch,len:ch,avgLuma:50,maxLuma:50,avgDb:-30,type:'BASE_GAME',score:0});
}

const mxL=Math.max(...segments.map(s=>s.maxLuma),1);
const mnD=Math.min(...segments.map(s=>s.avgDb));
const mxD=Math.max(...segments.map(s=>s.avgDb));
const dR =Math.max(mxD-mnD,1);
for (const s of segments) {
  const nL=s.maxLuma/mxL, nA=(s.avgDb-mnD)/dR;
  s.score = nL*0.65+nA*0.35;
  if (nL>0.78&&nA>0.45) s.type='BIG_WIN';
  else if (nL>0.60&&s.len<8) s.type='TRIGGER';
  i(`${s.type.padEnd(10)} ${s.start.toFixed(1)}-${s.end.toFixed(1)}s luma=${s.maxLuma.toFixed(0)} score=${s.score.toFixed(2)}`);
}

// For videos with no audio: use luma variance to distinguish WIN vs BASE
// Also skip first 3s (QuickTime UI / loading screens)
const MIN_START = 3.0;
const validSegs = segments.filter(s => s.start >= MIN_START || s.end > MIN_START + 2);

// Re-classify using luma variance if no audio differentiation
if (!audioFrames.length) {
  // Compute per-segment luma variance (high variance = active win flashes)
  for (const s of validSegs) {
    const lw = lumaFrames.filter(f => f.t >= s.start && f.t < s.end);
    if (lw.length > 1) {
      const mean = avg(lw, 'y');
      s.lumaVar = lw.reduce((acc, f) => acc + (f.y - mean)**2, 0) / lw.length;
    } else {
      s.lumaVar = 0;
    }
  }
  const maxVar = Math.max(...validSegs.map(s => s.lumaVar ?? 0), 1);
  for (const s of validSegs) {
    const nVar = (s.lumaVar ?? 0) / maxVar;
    const nL   = s.maxLuma / mxL;
    // Use time position as heuristic: later in video = more likely big win
    const timeFactor = s.start / duration; // 0→1
    s.score = nL * 0.4 + nVar * 0.3 + timeFactor * 0.3;
    if (timeFactor > 0.65 && nL > 0.5) s.type = 'BIG_WIN';
    else if (timeFactor > 0.35 && nVar > 0.4) s.type = 'TRIGGER';
    else s.type = 'BASE_GAME';
    i(`[reclass] ${s.type.padEnd(10)} ${s.start.toFixed(1)}s luma=${s.maxLuma.toFixed(0)} var=${(s.lumaVar??0).toFixed(0)} score=${s.score.toFixed(2)}`);
  }
}

const allValid    = validSegs.length ? validSegs : segments;
const basePool    = allValid.filter(s=>s.type==='BASE_GAME'&&s.len>=3).sort((a,b)=>a.start-b.start);
const triggerPool = allValid.filter(s=>s.type==='TRIGGER').sort((a,b)=>b.score-a.score);
const bigWinPool  = allValid.filter(s=>s.type==='BIG_WIN').sort((a,b)=>b.score-a.score);

// Ensure bigWin is different from base
if (!bigWinPool.length) {
  // Pick highest-scoring segment NOT already in basePool's first slot
  const best = [...allValid].sort((a,b)=>b.score-a.score).find(s => s !== basePool[0]);
  if (best) { best.type='BIG_WIN'; bigWinPool.push(best); }
  else if (allValid.length > 1) { allValid[allValid.length-1].type='BIG_WIN'; bigWinPool.push(allValid[allValid.length-1]); }
}
if (!basePool.length) {
  const b = allValid.find(s => s !== bigWinPool[0] && s !== triggerPool[0]);
  if (b) { b.type='BASE_GAME'; basePool.push(b); }
}

const DUR = {BASE_GAME:9,TRIGGER:4,BIG_WIN:11};
const timeline=[];
// Build timeline in order: BASE → TRIGGER → BIG_WIN
if (basePool[0])    timeline.push({...basePool[0],    dur:Math.min(DUR.BASE_GAME,basePool[0].len)});
if (triggerPool[0]) timeline.push({...triggerPool[0], dur:Math.min(DUR.TRIGGER,  triggerPool[0].len)});
const bw = bigWinPool.find(s => !timeline.some(t => t.start === s.start));
if (bw)             timeline.push({...bw, dur:Math.min(DUR.BIG_WIN, bw.len)});

if (!timeline.length) die('No usable segments found');
i(`Timeline: ${timeline.map(t=>`${t.type}(${t.dur.toFixed(1)}s@${t.start.toFixed(1)}s)`).join(' → ')}`);

/* ═══ STEP 6 — GENERATE TEXT ASSETS VIA PIL ═══════════════════ */
p(48, 'Generating text overlays (PIL)');

// Python script: generates all PNGs needed, prints JSON of paths
const pilScript = `
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

TMP = ${JSON.stringify(TMP)}
W, H = 1920, 1080

# Font discovery
def find_font(size):
    candidates = [
        '/System/Library/Fonts/HelveticaNeue.ttc',
        '/System/Library/Fonts/Helvetica.ttc',
        '/Library/Fonts/Arial.ttf',
        '/System/Library/Fonts/SFNSText.ttf',
        '/opt/homebrew/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                f = ImageFont.truetype(c, size)
                return f
            except: pass
    return ImageFont.load_default()

def text_center(draw, text, y_center, font, fill, img_w=W):
    try:
        bb = font.getbbox(text)
        tw = bb[2]-bb[0]
    except:
        tw = len(text)*size//2
    x = (img_w - tw) // 2
    draw.text((x, y_center), text, fill=fill, font=font)

# ── Lower third (RGBA overlay, 1920×74) ──
lt = Image.new('RGBA', (W, 74), (0,0,0,0))
ld = ImageDraw.Draw(lt)
# Dark bar
ld.rectangle([0,0,W,74], fill=(0,0,0,185))
# Gold left stripe
ld.rectangle([0,0,3,74], fill=(212,168,67,220))
f_lg = find_font(28)
f_sm = find_font(14)
ld.text((20, 10), 'BOJAN PETKOVIĆ', fill=(245,208,106), font=f_lg)
ld.text((20, 50), 'AUDIO DIRECTOR  ·  iGAMING SPECIALIST  ·  8+ yrs  ·  50+ titles', fill=(34,232,255,230), font=f_sm)
# Right align contact
contact = 'bojan@vanvinkl.com'
try:
    cw = f_sm.getbbox(contact)[2]
except:
    cw = len(contact)*8
ld.text((W-cw-20, 50), contact, fill=(255,255,255,160), font=f_sm)
lt_path = os.path.join(TMP, 'lt.png')
lt.save(lt_path)

# ── Slate generator (1920×1080 dark) ──
def make_slate(name, lines):
    img = Image.new('RGB', (W,H), (6,8,20))
    d = ImageDraw.Draw(img)
    # Subtle gold top & bottom bar
    d.rectangle([0,0,W,4], fill=(212,168,67))
    d.rectangle([0,H-4,W,H], fill=(212,168,67))
    total_h = sum(ln['size']+8 for ln in lines)
    y = (H - total_h)//2
    for ln in lines:
        f = find_font(ln['size'])
        try:
            bb = f.getbbox(ln['text'])
            tw = bb[2]-bb[0]
        except:
            tw = len(ln['text'])*ln['size']//2
        x = (W-tw)//2
        # Shadow
        d.text((x+2, y+2), ln['text'], fill=(0,0,0), font=f)
        d.text((x, y), ln['text'], fill=ln['color'], font=f)
        y += ln['size']+12
    path = os.path.join(TMP, name+'.png')
    img.save(path)
    return path

make_slate('s_intro', [
    {'text':'CASH ERUPTION: THE WESTERN','size':52,'color':(212,168,67)},
    {'text':'IGT  ·  2026  ·  Audio Director: Bojan Petkovic','size':24,'color':(160,168,192)},
])
make_slate('s_base',    [{'text':'BASE GAME',          'size':72,'color':(255,255,255)}])
make_slate('s_trigger', [{'text':'FEATURE TRIGGERED',  'size':64,'color':(34,232,255)}])
make_slate('s_bigwin',  [{'text':'BIG  WIN',           'size':88,'color':(255,215,0)}])
make_slate('s_outro', [
    {'text':'BOJAN PETKOVIC',                                    'size':64,'color':(245,208,106)},
    {'text':'AUDIO DIRECTOR  ·  iGAMING  ·  8+ YRS  ·  50+ TITLES','size':24,'color':(204,204,204)},
    {'text':'bojan@vanvinkl.com',                                'size':32,'color':(34,232,255)},
])

print(json.dumps({'lt': lt_path, 'tmp': TMP}))
`;

const pilResult = python(pilScript);
let pilPaths = {};
try { pilPaths = JSON.parse(pilResult.match(/\{.*\}/s)?.[0] ?? '{}'); } catch {}
const ltPng = pilPaths.lt ?? resolve(TMP, 'lt.png');
i('PIL assets generated');

/* ═══ STEP 7 — RENDER GAMEPLAY CLIPS ═══════════════════════════ */
p(55, `Rendering ${timeline.length} clips`);

const TW=1920, TH=1080;
const scaleF = `scale=${TW}:${TH}:force_original_aspect_ratio=decrease,pad=${TW}:${TH}:(ow-iw)/2:(oh-ih)/2`;
// HDR → SDR: colorspace filter (bt2020 → bt709)
const colorF = isHdr ? `,colorspace=bt709:iall=bt2020:fast=1` : '';
const baseVF = scaleF + colorF + `,format=yuv420p`;

const clipPaths=[];
for (let idx=0; idx<timeline.length; idx++) {
  const seg = timeline[idx];
  const fout = resolve(TMP, `clip-${idx}-${seg.type}.mp4`);
  clipPaths.push(fout);

  // Accent bar
  const accentColor = seg.type==='BIG_WIN' ? '0xFFD700' : seg.type==='TRIGGER' ? '0x22E8FF' : '0xFFFFFF@0.0';
  const accentF = seg.type!=='BASE_GAME'
    ? `,drawbox=x=0:y=0:w=iw:h=5:color=${accentColor}@0.9:t=fill` : '';

  // video filter chain
  const vf = `${baseVF}${accentF},fade=t=in:st=0:d=0.4,fade=t=out:st=${(seg.dur-0.4).toFixed(2)}:d=0.4`;

  const aFade = hasAudio
    ? ['-af', `afade=t=in:st=0:d=0.4,afade=t=out:st=${(seg.dur-0.4).toFixed(2)}:d=0.4`]
    : ['-an'];

  p(55+Math.round(idx/timeline.length*12), `Clip ${idx+1}: ${seg.type} @ ${seg.start.toFixed(1)}s`);

  // Two-input: video + lower-third PNG overlay
  if (existsSync(ltPng)) {
    ff([
      '-y',
      '-ss', seg.start.toFixed(3), '-i', INPUT, '-t', seg.dur.toFixed(3),
      '-loop','1','-i', ltPng,
      '-filter_complex', `[0:v]${vf}[v0];[1:v]format=rgba[lt];[v0][lt]overlay=0:H-74:shortest=1[out]`,
      '-map','[out]',
      ...aFade,
      '-c:v','libx264','-preset','fast','-crf','17',
      '-c:a','aac','-b:a','128k',
      '-pix_fmt','yuv420p','-r','30',
      '-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
      fout,
    ], `clip-${idx}`);
  } else {
    ff([
      '-y',
      '-ss', seg.start.toFixed(3), '-i', INPUT, '-t', seg.dur.toFixed(3),
      '-vf', vf,
      ...aFade,
      '-c:v','libx264','-preset','fast','-crf','17',
      '-c:a','aac','-b:a','128k',
      '-pix_fmt','yuv420p','-r','30',
      '-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
      fout,
    ], `clip-${idx}-nolt`);
  }
  i(`Clip ${idx+1} done: ${(statSync(fout).size/1024/1024).toFixed(1)}MB`);
}

/* ═══ STEP 8 — SLATE VIDEOS FROM PNGs ══════════════════════════ */
p(72, 'Converting slates to video');

function pngToVid(pngPath, outPath, dur) {
  if (!existsSync(pngPath)) return null;
  ff([
    '-y','-loop','1','-framerate','30','-i', pngPath,
    '-t', dur.toString(),
    '-vf', `format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=${(dur-0.4).toFixed(2)}:d=0.4`,
    '-an','-c:v','libx264','-preset','fast','-crf','18',
    outPath,
  ], `slate-${outPath.split('/').pop()}`);
  return outPath;
}

const introVid   = pngToVid(resolve(TMP,'s_intro.png'),   resolve(TMP,'sv_intro.mp4'),   2.5);
const baseCard   = pngToVid(resolve(TMP,'s_base.png'),    resolve(TMP,'sv_base.mp4'),    0.9);
const trigCard   = pngToVid(resolve(TMP,'s_trigger.png'), resolve(TMP,'sv_trigger.mp4'), 0.9);
const bigWinCard = pngToVid(resolve(TMP,'s_bigwin.png'),  resolve(TMP,'sv_bigwin.mp4'),  0.9);
const outroVid   = pngToVid(resolve(TMP,'s_outro.png'),   resolve(TMP,'sv_outro.mp4'),   3.5);

/* ═══ STEP 9 — CONCAT ══════════════════════════════════════════ */
p(82, 'Assembling final reel');

const allClips = [];
if (introVid)   allClips.push(introVid);
for (let idx=0; idx<timeline.length; idx++) {
  const t = timeline[idx];
  if (t.type==='BASE_GAME' && baseCard)   allClips.push(baseCard);
  if (t.type==='TRIGGER'   && trigCard)   allClips.push(trigCard);
  if (t.type==='BIG_WIN'   && bigWinCard) allClips.push(bigWinCard);
  allClips.push(clipPaths[idx]);
}
if (outroVid) allClips.push(outroVid);

const listPath = resolve(TMP,'concat.txt');
writeFileSync(listPath, allClips.filter(existsSync).map(p2=>`file '${p2}'`).join('\n')+'\n');

const concatPath = resolve(TMP,'concat.mp4');
ff(['-y','-f','concat','-safe','0','-i',listPath,
    '-c:v','libx264','-preset','fast','-crf','16',
    '-c:a','aac','-b:a','128k','-pix_fmt','yuv420p',
    concatPath], 'concat');

/* ═══ STEP 10 — AUDIO BED + FINAL ══════════════════════════════ */
p(90, 'Mixing audio bed');

const tdRaw = probe(['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',concatPath]);
const totalDur = parseFloat(tdRaw.match(/([\d.]+)/)?.[1] ?? '30');

const bedPath = resolve(TMP,'bed.aac');
const aEx=[
  `0.09*sin(2*PI*110*t)*(0.5+0.5*sin(2*PI*0.28*t))`,
  `0.06*sin(2*PI*165*t)*(0.5+0.5*sin(2*PI*0.37*t+0.9))`,
  `0.04*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.48*t+1.6))`,
  `0.03*sin(2*PI*277*t)*(0.5+0.5*sin(2*PI*0.19*t+2.3))`,
].join('+');
ff(['-y','-f','lavfi','-i',`aevalsrc=${aEx}:s=44100:c=stereo:d=${totalDur+1}`,
    '-af',`afade=in:st=0:d=1.5,afade=out:st=${(totalDur-1.5).toFixed(2)}:d=1.5,volume=0.22`,
    '-c:a','aac','-b:a','128k', bedPath], 'audio-bed');

p(95, 'Final encode');
const aFilter = hasAudio
  ? `[0:a]volume=0.85[ga];[1:a]volume=0.18[bed];[ga][bed]amix=inputs=2:duration=first:normalize=0[outa]`
  : `[1:a]volume=1.0[outa]`;
ff(['-y','-i',concatPath,'-i',bedPath,
    '-filter_complex',aFilter,
    '-map','0:v','-map','[outa]',
    '-c:v','libx264','-preset','slow','-crf','15',
    '-c:a','aac','-b:a','192k',
    '-pix_fmt','yuv420p','-movflags','+faststart',
    OUTPUT], 'final');

try { rmSync(TMP, {recursive:true,force:true}); } catch {}

const sizeMB = (statSync(OUTPUT).size/1024/1024).toFixed(1);
i(`Output: ${sizeMB}MB`);
process.stdout.write(`DONE:${OUTPUT}\n`);
