/**
 * SnapshotArt — generates a personalized SVG visualization of a
 * portfolio session.
 *
 * Input: PortfolioSnapshotV1 (the gzipped JSON shape from
 * SnapshotExport.ts). Output: a self-contained SVG string that
 * encodes the recruiter's interaction trace as a directed graph.
 *
 * Layout strategy (deterministic, looks the same for the same trace):
 *   • Each section visited becomes a node positioned by its
 *     occurrence sequence (left-to-right time axis)
 *   • Edges between consecutive section visits trace the path
 *   • Node radius encodes total dwell time on that section
 *   • Node color uses the section's brand palette token
 *   • Background = portfolio cyan/violet gradient — recognisable
 *     at thumbnail size in a chat / email
 *
 * Why ship this: snapshot already captures interaction trace; this
 * makes the trace shareable as art. Recruiter saves the SVG, drops
 * it into a hiring email, the next person on the chain sees a
 * visual proof of the engagement before clicking through.
 *
 * Pure function — no DOM, no side effects. Can run in a worker.
 */

import type { PortfolioSnapshotV1 } from './SnapshotExport'

// ─── Palette ─────────────────────────────────────────────────────────────────

const SECTION_COLOR: Record<string, string> = {
  projects: '#22e8ff',
  skills:   '#b14cff',
  about:    '#ffe6a8',
  career:   '#ff2bd6',
  contact:  '#4ade80',
}

const BG_FROM = '#08070d'
const BG_MID  = '#0f0a1a'
const EDGE    = 'rgba(255,255,255,0.55)'
const TEXT    = '#e6f0ff'

// ─── Layout ──────────────────────────────────────────────────────────────────

interface NodeLayout {
  name: string
  cx: number
  cy: number
  r: number
  visits: number
  dwellMs: number
}

const W = 1200
const H = 600
const PAD = 80

function buildNodes(snap: PortfolioSnapshotV1): NodeLayout[] {
  // Walk the event log to extract section-change events in order
  const visits: Array<{ name: string; at: number }> = []
  for (const e of snap.events) {
    if (e.event === 'slot:section:change' && e.payload && typeof e.payload === 'object') {
      const p = e.payload as { name?: string; idx?: number }
      if (p.name) visits.push({ name: p.name.toLowerCase(), at: e.timestamp })
    }
  }

  if (visits.length === 0) {
    // Fallback: synthesize a single node from whatever section the
    // snapshot was taken on so the SVG isn't empty.
    return [{
      name: `section-${snap.slot.sectionIdx}`,
      cx: W / 2,
      cy: H / 2,
      r: 26,
      visits: 1,
      dwellMs: snap.uptimeMs,
    }]
  }

  // Group by section name to get visit count + total dwell
  const groups = new Map<string, { visits: number; dwellMs: number; firstAt: number }>()
  for (let i = 0; i < visits.length; i++) {
    const v = visits[i]!
    const next = visits[i + 1]
    const dwell = next ? Math.max(0, next.at - v.at) : Math.max(0, snap.capturedAtMs - v.at)
    const g = groups.get(v.name) ?? { visits: 0, dwellMs: 0, firstAt: v.at }
    g.visits += 1
    g.dwellMs += dwell
    g.firstAt = Math.min(g.firstAt, v.at)
    groups.set(v.name, g)
  }

  // Position by first-occurrence order (left-to-right time axis)
  const sorted = [...groups.entries()].sort((a, b) => a[1].firstAt - b[1].firstAt)
  const innerW = W - 2 * PAD
  const step = sorted.length > 1 ? innerW / (sorted.length - 1) : 0

  return sorted.map(([name, g], idx) => {
    // Node radius — log scaled to keep extremes readable
    const dwellSec = g.dwellMs / 1000
    const r = Math.min(60, Math.max(18, 18 + Math.log10(dwellSec + 1) * 14))
    // Slight vertical wave so the path reads as motion
    const cy = H / 2 + Math.sin(idx * 0.9) * 60
    return {
      name,
      cx: PAD + step * idx,
      cy,
      r,
      visits: g.visits,
      dwellMs: g.dwellMs,
    }
  })
}

// ─── SVG composition ─────────────────────────────────────────────────────────

function escapeText(s: string): string {
  return s.replace(/[<>&"]/g, (c) =>
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '&' ? '&amp;' :
                '&quot;')
}

/**
 * Render the snapshot as a self-contained SVG document. Returns the
 * full XML string with `<?xml ?>` declaration so it can be saved
 * directly with the .svg extension and rendered by any browser.
 */
export function snapshotToSvg(snap: PortfolioSnapshotV1): string {
  const nodes = buildNodes(snap)

  const totalDwellSec = (nodes.reduce((a, n) => a + n.dwellMs, 0) / 1000).toFixed(1)
  const ts = snap.capturedAt.split('T')[0] ?? snap.capturedAt

  // Build edges = consecutive node pairs in chronological order
  const edges: string[] = []
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1]!
    const b = nodes[i]!
    edges.push(
      `<line x1="${a.cx.toFixed(1)}" y1="${a.cy.toFixed(1)}" `
      + `x2="${b.cx.toFixed(1)}" y2="${b.cy.toFixed(1)}" `
      + `stroke="${EDGE}" stroke-width="1.6" stroke-linecap="round" />`,
    )
  }

  // Node circles + labels
  const nodeMarkup = nodes.map((n) => {
    const c = SECTION_COLOR[n.name] ?? '#cccccc'
    return (
      `<g transform="translate(${n.cx.toFixed(1)},${n.cy.toFixed(1)})">`
      + `<circle r="${(n.r + 6).toFixed(1)}" fill="${c}" opacity="0.18" />`
      + `<circle r="${n.r.toFixed(1)}" fill="${c}" opacity="0.85" />`
      + `<text y="${(n.r + 22).toFixed(1)}" fill="${TEXT}" font-family="JetBrains Mono, monospace" `
      + `font-size="13" font-weight="700" text-anchor="middle">${escapeText(n.name.toUpperCase())}</text>`
      + `<text y="${(n.r + 38).toFixed(1)}" fill="${TEXT}" opacity="0.6" font-family="JetBrains Mono, monospace" `
      + `font-size="10" text-anchor="middle">${n.visits}× · ${(n.dwellMs / 1000).toFixed(1)}s</text>`
      + `</g>`
    )
  }).join('')

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
    + `<defs>`
    + `<radialGradient id="bg" cx="50%" cy="46%" r="70%">`
    + `<stop offset="0%" stop-color="${BG_MID}" />`
    + `<stop offset="100%" stop-color="${BG_FROM}" />`
    + `</radialGradient>`
    + `</defs>`
    + `<rect width="${W}" height="${H}" fill="url(#bg)" />`
    + `<text x="${PAD}" y="48" fill="${TEXT}" font-family="JetBrains Mono, monospace" font-size="16" font-weight="800">`
    + `BOJAN PETKOVIĆ · PORTFOLIO TRACE</text>`
    + `<text x="${PAD}" y="68" fill="${TEXT}" opacity="0.55" font-family="JetBrains Mono, monospace" font-size="11">`
    + `${escapeText(ts)} · ${totalDwellSec}s active · ${nodes.length} sections</text>`
    + edges.join('')
    + nodeMarkup
    + `</svg>`
  )
}

/**
 * Convenience helper — capture the current snapshot and return the
 * SVG string in one call. Useful from a UI button that doesn't
 * already have a snapshot in hand.
 */
export async function exportSnapshotSvg(): Promise<string> {
  const { captureSnapshot } = await import('./SnapshotExport')
  const snap = captureSnapshot()
  return snapshotToSvg(snap)
}

/** Save the current snapshot as an .svg via the standard download path. */
export async function downloadSnapshotSvg(): Promise<number> {
  const svg = await exportSnapshotSvg()
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const filename = `bojan-portfolio-trace-${Date.now()}.svg`

  const fsSupported = typeof window !== 'undefined' && 'showSaveFilePicker' in window
  if (fsSupported) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: {
          suggestedName: string
          types: Array<{ description: string; accept: Record<string, string[]> }>
        }) => Promise<FileSystemFileHandle>
      }).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Portfolio Trace SVG', accept: { 'image/svg+xml': ['.svg'] } }],
      })
      const w = await handle.createWritable()
      await w.write(blob)
      await w.close()
      return blob.size
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 0
      console.info('[SnapshotArt] FS Access failed, anchor fallback:', err)
    }
  }

  // Anchor fallback
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return blob.size
}
