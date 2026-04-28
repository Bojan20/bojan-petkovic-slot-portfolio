/**
 * Brand Assets Generator
 *
 * Renders branded HTML cards via Playwright headless → PNG sequences.
 * These are the cinematic frames that wrap the gameplay capture:
 *   - cold-open      (3-note oath flash)
 *   - hero-card      (BOJAN PETKOVIĆ name card)
 *   - metric-stack   (50+ titles · 200+ SFX · 0 defects · 8+ yrs)
 *   - about-strip
 *   - project-grid   (8 game tiles cycling)
 *   - skill-stack
 *   - career-timeline
 *   - cta-card       (book a call · contact)
 *
 * Each kind exports a single HTML page with `<body data-kind="...">` and
 * a small JS animator that hits well-defined CSS frame milestones tied
 * to time. The renderer captures @ 30fps.
 *
 * Why HTML+CSS not pure ffmpeg drawtext: brand parity with the live
 * portfolio (same fonts, same colors, same monogram), + CSS animations
 * give us micro-typography polish that drawtext cannot.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND, FORMATS, TIMELINE, PROJECTS, SKILLS, CAREER } from './config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────
// HTML CARD TEMPLATES — every kind renders one self-contained page
// ─────────────────────────────────────────────────────────────────────

function baseHead(width, height) {
  return `
<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
  *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${width}px; height: ${height}px;
    background: ${BRAND.colors.void};
    color: ${BRAND.colors.text};
    font-family: 'Inter', system-ui, sans-serif;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .stage { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%);
    pointer-events: none;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
  }
  .scan {
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 3px,
      rgba(255,255,255,0.012) 3px,
      rgba(255,255,255,0.012) 4px
    );
    pointer-events: none;
  }
  .monogram {
    font-family: 'Rajdhani', sans-serif;
    font-weight: 700;
    color: ${BRAND.colors.gold};
    letter-spacing: -0.05em;
  }
  .glow-gold { text-shadow: 0 0 40px ${BRAND.colors.gold}88, 0 0 12px ${BRAND.colors.gold}; }
  .glow-cyan { text-shadow: 0 0 40px ${BRAND.colors.cyan}88, 0 0 12px ${BRAND.colors.cyan}; }
  .glow-mag  { text-shadow: 0 0 40px ${BRAND.colors.magenta}88, 0 0 12px ${BRAND.colors.magenta}; }
  .uppercase { text-transform: uppercase; letter-spacing: 0.18em; }
  .mono { font-family: 'JetBrains Mono', monospace; }

  @keyframes fadeIn   { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes fadeOut  { from { opacity: 1 } to { opacity: 0 } }
  @keyframes scaleIn  { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes shimmer  { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.4); } }
  @keyframes spinCW   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes pulse    { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  @keyframes slide    { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes ringPulse {
    0%   { transform: scale(0.6); opacity: 0; }
    50%  { opacity: 0.8; }
    100% { transform: scale(2.4); opacity: 0; }
  }
</style></head><body><div class="stage">
<div class="grid-bg"></div>
<div class="scan"></div>
<div class="vignette"></div>`;
}

function htmlClose() {
  return `</div></body></html>`;
}

// ── kind: oath-hit ──────────────────────────────────────────────────────
function renderOathHit({ width, height }) {
  const w = width, h = height;
  const monoSize = Math.round(Math.min(w, h) * 0.32);
  return baseHead(w, h) + `
  <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
    <div class="ring" style="position:absolute; width:${monoSize * 1.4}px; height:${monoSize * 1.4}px;
      border:2px solid ${BRAND.colors.gold}aa; border-radius:50%;
      animation: ringPulse 1.4s ease-out 0.0s 1;"></div>
    <div class="ring" style="position:absolute; width:${monoSize * 1.4}px; height:${monoSize * 1.4}px;
      border:2px solid ${BRAND.colors.cyan}aa; border-radius:50%;
      animation: ringPulse 1.4s ease-out 0.3s 1;"></div>
    <div class="ring" style="position:absolute; width:${monoSize * 1.4}px; height:${monoSize * 1.4}px;
      border:2px solid ${BRAND.colors.magenta}aa; border-radius:50%;
      animation: ringPulse 1.4s ease-out 0.6s 1;"></div>
    <div class="monogram glow-gold" style="font-size: ${monoSize}px; line-height: 1; animation: scaleIn 0.6s ease-out, shimmer 1.6s ease-in-out infinite;">VV</div>
  </div>
  <div style="position:absolute; bottom:${Math.round(h * 0.08)}px; width:100%; text-align:center;
    animation: fadeIn 0.8s ease-out 0.7s both;">
    <div class="uppercase mono" style="color:${BRAND.colors.cyan}; font-size:${Math.round(w * 0.018)}px;">SIGNATURE · 3-NOTE OATH</div>
    <div class="mono" style="color:${BRAND.colors.textDim}; font-size:${Math.round(w * 0.014)}px; margin-top:6px;">G · C · E · 390ms</div>
  </div>` + htmlClose();
}

// ── kind: name-card ─────────────────────────────────────────────────────
function renderNameCard({ width, height }) {
  const w = width, h = height;
  const isPortrait = h > w;
  const nameSize = isPortrait ? Math.round(w * 0.085) : Math.round(w * 0.062);
  return baseHead(w, h) + `
  <div style="position:absolute; inset:0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:${isPortrait ? 28 : 22}px;">
    <div class="uppercase mono" style="color:${BRAND.colors.cyan}; font-size:${Math.round(nameSize * 0.22)}px;
      animation: fadeIn 0.6s ease-out;">${BRAND.role}</div>
    <h1 class="monogram glow-gold" style="font-size:${nameSize}px; line-height:1; letter-spacing:-0.03em;
      animation: scaleIn 0.8s cubic-bezier(.2,.8,.2,1);">${BRAND.name.toUpperCase()}</h1>
    <div style="width:${Math.round(w * 0.18)}px; height:2px;
      background:linear-gradient(90deg, transparent, ${BRAND.colors.gold}, transparent);
      animation: fadeIn 0.6s ease-out 0.3s both;"></div>
    <div class="uppercase" style="color:${BRAND.colors.text}cc; font-size:${Math.round(nameSize * 0.26)}px;
      letter-spacing:0.22em; animation: fadeIn 0.8s ease-out 0.5s both;">${BRAND.tagline}</div>
  </div>` + htmlClose();
}

// ── kind: metric-stack ──────────────────────────────────────────────────
function renderMetricStack({ width, height }) {
  const w = width, h = height;
  const isPortrait = h > w;
  const items = [
    { val: BRAND.metrics.titles,  lbl: 'TITLES SHIPPED', color: BRAND.colors.gold },
    { val: BRAND.metrics.sfx,     lbl: 'SFX PER GAME',   color: BRAND.colors.cyan },
    { val: BRAND.metrics.defects, lbl: 'AUDIO DEFECTS',  color: BRAND.colors.magenta },
    { val: BRAND.metrics.years,   lbl: 'YEARS IGAMING',  color: '#00ff88' },
  ];
  const valSize = isPortrait ? Math.round(w * 0.16) : Math.round(w * 0.09);
  const lblSize = Math.round(valSize * 0.18);
  const dir = isPortrait ? 'column' : 'row';
  const gap = isPortrait ? 36 : 80;
  return baseHead(w, h) + `
  <div style="position:absolute; inset:0; display:flex; flex-direction:${dir};
    align-items:center; justify-content:center; gap:${gap}px;">
    ${items.map((it, i) => `
      <div style="text-align:center; animation: slide 0.6s cubic-bezier(.2,.8,.2,1) ${i * 0.12}s both;">
        <div class="monogram" style="font-size:${valSize}px; line-height:1; color:${it.color};
          text-shadow:0 0 32px ${it.color}88, 0 0 8px ${it.color};">${it.val}</div>
        <div class="uppercase mono" style="color:${BRAND.colors.textDim}; font-size:${lblSize}px;
          margin-top:${Math.round(valSize * 0.12)}px;">${it.lbl}</div>
      </div>
    `).join('')}
  </div>` + htmlClose();
}

// ── kind: project-grid ──────────────────────────────────────────────────
function renderProjectGrid({ width, height }) {
  const w = width, h = height;
  const isPortrait = h > w;
  const cols = isPortrait ? 2 : 4;
  const rows = isPortrait ? 5 : 3;
  const tileGap = 18;
  const padding = Math.round(w * 0.05);
  const innerW = w - padding * 2;
  const innerH = h - padding * 2;
  const tileW = (innerW - tileGap * (cols - 1)) / cols;
  const tileH = (innerH - tileGap * (rows - 1) - 60) / rows; // -60 for title strip
  const tiles = PROJECTS.slice(0, cols * rows).map((p, i) => `
    <div style="
      width:${tileW}px; height:${tileH}px;
      background: linear-gradient(135deg, ${p.color}22, ${p.color}05);
      border: 1.5px solid ${p.color}55;
      border-radius: 12px; padding: 16px;
      display:flex; flex-direction:column; justify-content:space-between;
      animation: slide 0.5s cubic-bezier(.2,.8,.2,1) ${i * 0.06}s both;
      box-shadow: 0 0 24px ${p.color}22;
    ">
      <div class="mono" style="font-size:${Math.round(tileH * 0.13)}px; color:${p.color}; letter-spacing:0.18em;">${p.studio.split(' · ')[0]}</div>
      <div class="monogram" style="font-size:${Math.round(tileH * 0.18)}px; color:${BRAND.colors.text}; line-height:1.0;">${p.name}</div>
      <div class="uppercase mono" style="font-size:${Math.round(tileH * 0.10)}px; color:${BRAND.colors.textDim};">${p.studio.split(' · ')[1] || ''}</div>
    </div>
  `).join('');
  return baseHead(w, h) + `
  <div style="position:absolute; inset:${padding}px; display:flex; flex-direction:column; gap:18px;">
    <div style="text-align:center;">
      <div class="uppercase mono" style="color:${BRAND.colors.cyan}; font-size:${Math.round(w * 0.018)}px;">SHIPPED · LAST 3 YEARS</div>
      <div class="monogram glow-gold" style="font-size:${Math.round(w * 0.04)}px; margin-top:6px;">${PROJECTS.length} TITLES</div>
    </div>
    <div style="display:grid; grid-template-columns: repeat(${cols}, 1fr); gap:${tileGap}px; flex: 1;">
      ${tiles}
    </div>
  </div>` + htmlClose();
}

// ── kind: skill-stack ───────────────────────────────────────────────────
function renderSkillStack({ width, height }) {
  const w = width, h = height;
  const isPortrait = h > w;
  const padding = Math.round(w * 0.06);
  const rowH = isPortrait ? Math.round(h * 0.10) : Math.round(h * 0.085);
  const labelSize = Math.round(rowH * 0.30);
  return baseHead(w, h) + `
  <div style="position:absolute; inset:${padding}px; display:flex; flex-direction:column; gap:14px;">
    <div style="text-align:center; margin-bottom:18px;">
      <div class="uppercase mono" style="color:${BRAND.colors.cyan}; font-size:${Math.round(w * 0.018)}px;">CORE STACK</div>
      <div class="monogram glow-gold" style="font-size:${Math.round(w * 0.04)}px; margin-top:6px;">SKILL MATRIX</div>
    </div>
    ${SKILLS.map((s, i) => `
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:${Math.round(rowH * 0.18)}px ${Math.round(rowH * 0.30)}px;
        height:${rowH}px;
        background: linear-gradient(90deg, ${s.color}22, transparent);
        border-left: 4px solid ${s.color};
        border-radius: 0 8px 8px 0;
        animation: slide 0.5s cubic-bezier(.2,.8,.2,1) ${i * 0.08}s both;
      ">
        <div class="monogram" style="color:${BRAND.colors.text}; font-size:${labelSize}px; letter-spacing:0.04em;">${s.name}</div>
        <div class="uppercase mono" style="color:${s.color}; font-size:${Math.round(labelSize * 0.62)}px; letter-spacing:0.18em;
          text-shadow: 0 0 12px ${s.color}88;">${s.level}</div>
      </div>
    `).join('')}
  </div>` + htmlClose();
}

// ── kind: career-timeline ───────────────────────────────────────────────
function renderCareerTimeline({ width, height }) {
  const w = width, h = height;
  const isPortrait = h > w;
  const padding = Math.round(w * 0.06);
  const dotSize = 16;
  return baseHead(w, h) + `
  <div style="position:absolute; inset:${padding}px; display:flex; flex-direction:column;">
    <div style="text-align:center; margin-bottom:30px;">
      <div class="uppercase mono" style="color:${BRAND.colors.cyan}; font-size:${Math.round(w * 0.018)}px;">CAREER · IGAMING AUDIO</div>
      <div class="monogram glow-gold" style="font-size:${Math.round(w * 0.04)}px; margin-top:6px;">8 YEARS · 4 ERAS</div>
    </div>
    <div style="position:relative; flex:1; padding-left:${dotSize * 2.5}px;">
      <div style="position:absolute; left:${dotSize / 2 - 1}px; top:0; bottom:0; width:2px;
        background: linear-gradient(to bottom, ${BRAND.colors.gold}, ${BRAND.colors.magenta}, ${BRAND.colors.cyan});"></div>
      ${CAREER.map((c, i) => `
        <div style="position:relative; margin-bottom:${isPortrait ? 32 : 28}px;
          animation: slide 0.6s cubic-bezier(.2,.8,.2,1) ${i * 0.15}s both;">
          <div style="position:absolute; left:-${dotSize * 2}px; top:6px;
            width:${dotSize}px; height:${dotSize}px; border-radius:50%;
            background:${BRAND.colors.gold}; box-shadow:0 0 16px ${BRAND.colors.gold};"></div>
          <div class="mono uppercase" style="color:${BRAND.colors.cyan}; font-size:${Math.round(w * 0.014)}px;">${c.period}</div>
          <div class="monogram glow-gold" style="font-size:${Math.round(w * 0.034)}px; margin:6px 0;">${c.company}</div>
          <div style="color:${BRAND.colors.text}cc; font-size:${Math.round(w * 0.018)}px;">${c.role}</div>
        </div>
      `).join('')}
    </div>
  </div>` + htmlClose();
}

// ── kind: about-strip ───────────────────────────────────────────────────
function renderAboutStrip({ width, height }) {
  const w = width, h = height;
  const padding = Math.round(w * 0.08);
  return baseHead(w, h) + `
  <div style="position:absolute; inset:${padding}px; display:flex; flex-direction:column; justify-content:center; gap:32px;">
    <div class="uppercase mono" style="color:${BRAND.colors.cyan}; font-size:${Math.round(w * 0.018)}px; animation:fadeIn .6s;">ABOUT · BELGRADE, RS</div>
    <div class="monogram" style="font-size:${Math.round(w * 0.05)}px; color:${BRAND.colors.text}; line-height:1.15;
      animation: slide .8s cubic-bezier(.2,.8,.2,1) .15s both;">
      Senior audio professional<br>
      <span style="color:${BRAND.colors.gold}; text-shadow: 0 0 24px ${BRAND.colors.gold}66;">specializing in iGaming & slot audio</span> production.
    </div>
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:18px; margin-top:20px;">
      ${['BELGRADE, RS','8+ YEARS','MUSICIAN','REMOTE WW'].map((tag, i) => `
        <div style="padding:14px 18px; border:1.5px solid ${BRAND.colors.cyan}66; border-radius:8px;
          background: ${BRAND.colors.cyan}11;
          text-align:center; animation: slide .5s ease-out ${0.3 + i * 0.08}s both;">
          <div class="mono uppercase" style="color:${BRAND.colors.cyan}; font-size:${Math.round(w * 0.014)}px; letter-spacing:0.16em;">${tag}</div>
        </div>
      `).join('')}
    </div>
  </div>` + htmlClose();
}

// ── kind: cta-card ──────────────────────────────────────────────────────
function renderCtaCard({ width, height }) {
  const w = width, h = height;
  const isPortrait = h > w;
  return baseHead(w, h) + `
  <div style="position:absolute; inset:0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:${isPortrait ? 24 : 28}px;">
    <div class="uppercase mono" style="color:${BRAND.colors.cyan}; font-size:${Math.round(w * 0.020)}px;
      animation: fadeIn 0.6s;">OPEN FOR HIRE · WORLDWIDE</div>
    <h1 class="monogram glow-gold" style="font-size:${isPortrait ? Math.round(w * 0.10) : Math.round(w * 0.07)}px;
      line-height:1; letter-spacing:-0.03em;
      animation: scaleIn 0.8s cubic-bezier(.2,.8,.2,1);">LET'S BUILD<br>SOUND TOGETHER</h1>
    <div style="width:${Math.round(w * 0.16)}px; height:2px;
      background:linear-gradient(90deg, transparent, ${BRAND.colors.gold}, transparent);"></div>
    <div style="display:flex; flex-direction:${isPortrait ? 'column' : 'row'}; gap:${isPortrait ? 14 : 28}px;
      align-items:center; animation: fadeIn 0.6s ease-out 0.4s both;">
      <div class="mono" style="color:${BRAND.colors.text}; font-size:${Math.round(w * 0.022)}px; letter-spacing:0.06em;">📧 ${BRAND.contact.email}</div>
      <div class="mono" style="color:${BRAND.colors.text}cc; font-size:${Math.round(w * 0.018)}px; letter-spacing:0.06em;">${BRAND.contact.linkedin}</div>
    </div>
    <div style="margin-top:20px; padding:18px 36px;
      border:2px solid ${BRAND.colors.gold}; border-radius:8px;
      background: ${BRAND.colors.gold}22;
      animation: pulse 1.6s ease-in-out infinite, fadeIn 0.6s ease-out 0.6s both;">
      <div class="uppercase monogram" style="color:${BRAND.colors.gold}; font-size:${Math.round(w * 0.024)}px;
        letter-spacing:0.20em;">▶ BOOK A CALL</div>
    </div>
    <div style="margin-top:20px;" class="uppercase mono">
      <span style="color:${BRAND.colors.textDim}; font-size:${Math.round(w * 0.014)}px;">${BRAND.tagline}</span>
    </div>
  </div>` + htmlClose();
}

// ── kind: lower-third (overlay used during gameplay capture) ─────────────
function renderLowerThird({ width, height, label = 'LIVE GAMEPLAY · CASH ERUPTION WESTERN · IGT 2023' }) {
  const w = width, h = height;
  const isPortrait = h > w;
  const barH = Math.round(h * (isPortrait ? 0.10 : 0.13));
  return baseHead(w, h) + `
  <div style="position:absolute; left:0; right:0; bottom:${Math.round(h * 0.04)}px;
    display:flex; align-items:center; gap:18px; padding:0 ${Math.round(w * 0.05)}px;
    height:${barH}px;
    background: linear-gradient(90deg, ${BRAND.colors.void}ee 0%, ${BRAND.colors.void}aa 70%, transparent);
    backdrop-filter: blur(8px);
    border-top: 2px solid ${BRAND.colors.gold}aa;">
    <div class="monogram glow-gold" style="font-size:${Math.round(barH * 0.55)}px; line-height:1;">VV</div>
    <div style="flex:1;">
      <div class="monogram" style="color:${BRAND.colors.text}; font-size:${Math.round(barH * 0.32)}px; line-height:1.0;">${BRAND.name.toUpperCase()}</div>
      <div class="mono uppercase" style="color:${BRAND.colors.cyan}; font-size:${Math.round(barH * 0.16)}px; letter-spacing:0.18em; margin-top:4px;">${label}</div>
    </div>
    <div class="mono uppercase" style="color:${BRAND.colors.gold}; font-size:${Math.round(barH * 0.18)}px;">audio ▸ direction ▸ qa</div>
  </div>` + htmlClose();
}

// ─────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────

const RENDERERS = {
  'oath-hit':         renderOathHit,
  'name-card':        renderNameCard,
  'metric-stack':     renderMetricStack,
  'project-grid':     renderProjectGrid,
  'skill-stack':      renderSkillStack,
  'career-timeline':  renderCareerTimeline,
  'about-strip':      renderAboutStrip,
  'cta-card':         renderCtaCard,
  'lower-third':      renderLowerThird,
};

/**
 * Render a card kind to a single PNG.
 *
 * @param {object} opts
 * @param {string} opts.kind     — one of the keys in RENDERERS
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {string} opts.outPath  — absolute output path
 * @param {object} [opts.extra]  — extra options passed to renderer
 * @param {number} [opts.delay]  — ms to wait for animations to settle (default 1500)
 */
export async function renderCard({ kind, width, height, outPath, extra = {}, delay = 1500, browser = null }) {
  const renderer = RENDERERS[kind];
  if (!renderer) throw new Error(`Unknown card kind: ${kind}`);
  const html = renderer({ width, height, ...extra });
  mkdirSync(dirname(outPath), { recursive: true });

  const ownsBrowser = !browser;
  if (ownsBrowser) browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  // Wait for fonts.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(delay);
  await page.screenshot({ path: outPath, type: 'png' });
  await ctx.close();
  if (ownsBrowser) await browser.close();
  return outPath;
}

/**
 * Render every card kind for a given format (vertical/landscape) into PNGs.
 *
 * @param {'vertical'|'landscape'} formatKey
 * @returns {Promise<Record<string,string>>} kind → absolute path
 */
export async function renderAllCards(formatKey) {
  const fmt = FORMATS[formatKey];
  const outDir = resolve(ROOT, 'assets', 'cards', formatKey);
  if (existsSync(outDir)) rmSync(outDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const out = {};
    for (const kind of Object.keys(RENDERERS)) {
      const outPath = resolve(outDir, `${kind}.png`);
      await renderCard({ kind, width: fmt.width, height: fmt.height, outPath, browser });
      out[kind] = outPath;
      console.log(`  ✓ ${formatKey}/${kind}.png`);
    }
    // Manifest for downstream stages.
    writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify({ format: formatKey, ...fmt, cards: out }, null, 2));
    return out;
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const formats = process.argv.slice(2);
  const targets = formats.length ? formats : ['vertical', 'landscape'];
  for (const f of targets) {
    if (!FORMATS[f]) { console.error(`Unknown format: ${f}`); process.exit(1); }
    console.log(`\n▸ Rendering brand cards for [${f}] (${FORMATS[f].width}×${FORMATS[f].height})`);
    await renderAllCards(f);
  }
  console.log('\n✓ All brand cards rendered.');
}
