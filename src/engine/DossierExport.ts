/**
 * DossierExport — V7.1 print-optimized PDF dossier for recruiter cards.
 *
 * Recruiter clicks DOSSIER inside an open CardDetail panel → we open
 * a new window with a print-friendly clone of the same content + an
 * automatic print dialog. The recruiter saves as PDF (browser native),
 * gets a one-page deliverable they can attach to a hiring ticket.
 *
 * Source content is the SAME html string returned by buildDetailHTML —
 * we just re-render it inside a self-contained <style> block tuned for
 * paper instead of the cinematic dark glass look.
 *
 * No deps. Pure DOM. Falls back gracefully if popups are blocked.
 */

import type { SectionId } from '../types'
import { buildDetailHTML } from '../components/slot/cabinet/detailBuilders'
import cardDetailStyles from '../components/slot/cabinet/CardDetail.module.css'
import { shareableUrl } from './DeepLink'

// ─────────────────────────────────────────────────────────────────────
// Print stylesheet — light paper theme, ink-saving, A4-friendly
// ─────────────────────────────────────────────────────────────────────

function buildPrintCss(glow: string): string {
  return `
@page { size: A4 portrait; margin: 14mm 14mm 16mm; }

:root { --card-glow: ${glow}; --ink: #111; --line: #d8d3e8; }

* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body {
  margin: 0; padding: 0;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--ink);
  background: #fff;
}

.dossier {
  max-width: 720px;
  margin: 0 auto;
  padding: 6mm 0 0;
}

.brandBar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 6mm;
  border-bottom: 2px solid var(--card-glow);
  margin-bottom: 6mm;
}
.brandLeft  { font-size: 11pt; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; }
.brandRight { font-size: 8pt;  letter-spacing: 2px; color: #555; }
.brandRight a { color: var(--card-glow); text-decoration: none; }

.urlChip {
  display: inline-block;
  margin-top: 2mm;
  padding: 1.5mm 3mm;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 7.5pt;
  background: #f5f3fb;
  border: 1px solid var(--line);
  border-radius: 2pt;
  color: #444;
  word-break: break-all;
}

/* CardDetail clone — flatten the cinematic look into print-grade */
.${cardDetailStyles.panel ?? 'panel'} {
  position: static !important;
  inset: auto !important;
  background: #fff !important;
  color: var(--ink) !important;
  border: 1px solid var(--line) !important;
  box-shadow: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
  animation: none !important;
  display: block !important;
  overflow: visible !important;
}
.${cardDetailStyles.panel ?? 'panel'}::before,
.${cardDetailStyles.panel ?? 'panel'}::after {
  display: none !important;
}

/* Strip dark glass children of dark glass; raise contrast */
.${cardDetailStyles.hero ?? 'hero'} {
  border-bottom: 2px solid var(--card-glow) !important;
  padding: 0 0 4mm !important;
  margin: 0 0 4mm !important;
}
.${cardDetailStyles.hero ?? 'hero'}::before,
.${cardDetailStyles.hero ?? 'hero'}::after { display: none !important; }
.${cardDetailStyles.heroIcon ?? 'heroIcon'} { color: var(--card-glow) !important; filter: none !important; }
.${cardDetailStyles.heroEyebrow ?? 'heroEyebrow'}::after { content: '' !important; }
.${cardDetailStyles.heroEyebrow ?? 'heroEyebrow'} { color: var(--card-glow) !important; text-shadow: none !important; }
.${cardDetailStyles.heroName ?? 'heroName'} {
  background: none !important;
  -webkit-text-fill-color: var(--ink) !important;
  color: var(--ink) !important;
}
.${cardDetailStyles.heroName ?? 'heroName'}::before,
.${cardDetailStyles.heroName ?? 'heroName'}::after { display: none !important; }
.${cardDetailStyles.heroStudio ?? 'heroStudio'} { color: #555 !important; }

.${cardDetailStyles.pitch ?? 'pitch'} { color: var(--ink) !important; border-left-color: var(--card-glow) !important; }

.${cardDetailStyles.statCard ?? 'statCard'},
.${cardDetailStyles.factCell ?? 'factCell'},
.${cardDetailStyles.tech ?? 'tech'},
.${cardDetailStyles.contactBig ?? 'contactBig'} {
  background: #fafaff !important;
  border: 1px solid var(--line) !important;
  color: var(--ink) !important;
}
.${cardDetailStyles.statCard ?? 'statCard'}::before,
.${cardDetailStyles.factCell ?? 'factCell'}::before,
.${cardDetailStyles.contactBig ?? 'contactBig'}::after { display: none !important; }

.${cardDetailStyles.statValue ?? 'statValue'} { color: var(--card-glow) !important; text-shadow: none !important; }
.${cardDetailStyles.statLabel ?? 'statLabel'} { color: #666 !important; }

.${cardDetailStyles.toolChip ?? 'toolChip'} {
  background: #fff !important;
  border: 1px solid var(--card-glow) !important;
  color: var(--ink) !important;
}
.${cardDetailStyles.toolChip ?? 'toolChip'}::before { display: none !important; }

.${cardDetailStyles.skillBar ?? 'skillBar'} { background: #ece6fa !important; border-color: var(--line) !important; }
.${cardDetailStyles.skillBarFill ?? 'skillBarFill'} {
  background: var(--card-glow) !important;
  box-shadow: none !important;
  animation: none !important;
}
.${cardDetailStyles.skillBarFill ?? 'skillBarFill'}::after { display: none !important; }
.${cardDetailStyles.skillMeterLabel ?? 'skillMeterLabel'} { color: var(--card-glow) !important; text-shadow: none !important; }
.${cardDetailStyles.skillMeterYears ?? 'skillMeterYears'} { color: #555 !important; }
.${cardDetailStyles.skillBarTicks ?? 'skillBarTicks'} > span { border-color: rgba(0,0,0,0.10) !important; }
.${cardDetailStyles.skillBarLegend ?? 'skillBarLegend'} { color: #888 !important; }

.${cardDetailStyles.timelineRail ?? 'timelineRail'} { background: var(--card-glow) !important; opacity: 0.55; }
.${cardDetailStyles.timelineDot ?? 'timelineDot'} { background: #fff !important; border-color: var(--card-glow) !important; }
.${cardDetailStyles.timelineDotActive ?? 'timelineDotActive'} {
  background: var(--card-glow) !important;
  box-shadow: none !important;
  animation: none !important;
}
.${cardDetailStyles.timelineDotActive ?? 'timelineDotActive'}::after { display: none !important; }
.${cardDetailStyles.timelineMark ?? 'timelineMark'} { color: #444 !important; }
.${cardDetailStyles.timelineMarkEnd ?? 'timelineMarkEnd'} { color: var(--card-glow) !important; }

.${cardDetailStyles.contactValue ?? 'contactValue'} { color: var(--ink) !important; text-shadow: none !important; }

/* Strip the dark wave bars — print as a flat label */
.${cardDetailStyles.wave ?? 'wave'} { border: 1px dashed var(--line); padding: 3mm 4mm; border-radius: 2pt; }
.${cardDetailStyles.waveBars ?? 'waveBars'} { background: none !important; border: none !important; }
.${cardDetailStyles.waveBar ?? 'waveBar'} {
  background: var(--card-glow) !important;
  box-shadow: none !important;
  animation: none !important;
  opacity: 0.7 !important;
}

.${cardDetailStyles.cta ?? 'cta'},
.${cardDetailStyles.cta ?? 'cta'}::before,
.${cardDetailStyles.cta ?? 'cta'}::after { display: none !important; }

.footnote {
  margin-top: 8mm;
  padding-top: 4mm;
  border-top: 1px solid var(--line);
  font-size: 7.5pt;
  color: #777;
  display: flex;
  justify-content: space-between;
  gap: 4mm;
}

@media screen {
  body { background: #2a2438; }
  .dossier {
    background: #fff;
    margin: 20px auto;
    padding: 22mm 18mm;
    box-shadow: 0 30px 80px rgba(0,0,0,0.4);
    border-radius: 6px;
  }
  .toolbar {
    position: fixed; top: 12px; right: 12px;
    display: flex; gap: 8px;
    z-index: 999;
    font-family: 'Inter', sans-serif;
  }
  .toolbar button {
    appearance: none;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    cursor: pointer;
  }
  .toolbar button:hover { background: var(--card-glow); color: #fff; border-color: var(--card-glow); }
}

@media print {
  .toolbar { display: none !important; }
  body { background: #fff; }
  .dossier { box-shadow: none; }
}
`
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export interface DossierRequest {
  sectionId: SectionId
  itemIdx: number
  /** Display name for the dossier title bar (e.g. project name) */
  cardName: string
}

/**
 * Open a new window with a printable dossier of the given card.
 * Returns true if window opened, false if popup was blocked.
 *
 * The new window:
 *  • Renders the same buildDetailHTML output → 100% data parity.
 *  • Strips the cinematic dark theme via flat-overrides print stylesheet.
 *  • Adds a brand-bar header + footer with shareable URL.
 *  • Auto-invokes window.print() once content paints.
 *  • Has Print + Close buttons in screen view (for users who dismiss
 *    the auto-print dialog and want a second go).
 */
export function exportDossier(req: DossierRequest): boolean {
  if (typeof window === 'undefined') return false

  const { html, color } = buildDetailHTML(
    req.sectionId,
    req.itemIdx,
    cardDetailStyles as Record<string, string | undefined>,
  )
  if (!html) return false

  const win = window.open('', '_blank', 'width=900,height=1200')
  if (!win) return false

  const url = shareableUrl({ sectionId: req.sectionId, itemIdx: req.itemIdx, wantDetail: true })
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

  const escName = req.cardName.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&#39;',
  )
  const sectionLabel = req.sectionId.toUpperCase()

  win.document.open()
  win.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Dossier · ${escName} · Bojan Petković</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>${buildPrintCss(color)}</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" data-print>PRINT / SAVE PDF</button>
    <button type="button" data-close>CLOSE</button>
  </div>

  <div class="dossier">
    <header class="brandBar">
      <div class="brandLeft">BOJAN PETKOVIĆ · DOSSIER · ${sectionLabel}</div>
      <div class="brandRight">${date}</div>
    </header>

    ${html}

    <footer class="footnote">
      <span>Live version: <span class="urlChip">${url}</span></span>
      <span>bojan.petkovic25@gmail.com</span>
    </footer>
  </div>

  <script>
    (function () {
      var pBtn = document.querySelector('[data-print]');
      var cBtn = document.querySelector('[data-close]');
      if (pBtn) pBtn.addEventListener('click', function () { window.print(); });
      if (cBtn) cBtn.addEventListener('click', function () { window.close(); });
      // Auto-print once fonts settle (else first print uses fallback fonts)
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { setTimeout(function () { window.print(); }, 250); });
      } else {
        setTimeout(function () { window.print(); }, 600);
      }
    })();
  </script>
</body>
</html>`)
  win.document.close()
  return true
}
