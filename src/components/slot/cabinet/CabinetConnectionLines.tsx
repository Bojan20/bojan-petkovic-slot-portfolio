/**
 * CabinetConnectionLines — V5.1 affinity link visualizer.
 *
 * Existing engine already broadcasts custom:cell:hover:start with the
 * hovered cell's tools + color (P1.9 affinity halo). Other cells
 * pulse on receive. This component adds a VISUAL layer — neon SVG
 * lines that connect the hovered cell to every related cell across
 * the reel grid.
 *
 * On hover-start:
 *   • Read the hovered cell's data-cell-id + bounding rect
 *   • Find all cells with matching tools or color
 *   • Render an SVG path (curved bezier) from hover cell to each match
 *
 * On hover-end: lines fade out via opacity transition.
 *
 * Pure DOM/CSS — no canvas, no library. SVG paints over the grid at
 * z-index 100 (below cells which sit at higher z-indexes inside the
 * cabinet, but above the parallax world).
 */

import { useEffect, useRef, useState } from 'react'
import { bus } from '../../../engine'
import styles from './CabinetConnectionLines.module.css'

interface Line {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  color: string
}

const MAX_LINES = 4
const HOVER_THROTTLE_MS = 28 // ~36Hz cap

export function CabinetConnectionLines() {
  const [lines, setLines] = useState<Line[]>([])
  const fadeTimerRef = useRef<number>(0)
  const lastEmitRef = useRef<number>(0)
  const suspendedRef = useRef<boolean>(false)

  // V7.4 — early-exit on mobile (≤640px). CSS already hides the
  // SVG; this skips the bus subscriptions + DOM walks entirely so
  // Cell hovers don't burn cycles for a layer that's invisible.
  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(max-width: 640px)').matches

  useEffect(() => {
    if (isMobile) return
    // V7.2 — gate: skip while payline takeover is up (recruiter is
    // already focused on a single card — affinity lines would be
    // visual noise overlaying the cinematic stage). Also skip on
    // prefers-reduced-motion + critical perf pressure (CSS already
    // hides via display:none, but skipping the work avoids reads).
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const offStart = bus.on('custom:cell:hover:start', (p) => {
      if (reduced) return
      if (typeof document !== 'undefined' && document.body.hasAttribute('data-payline-active')) return
      if (suspendedRef.current) return

      // Throttle — Cell hovers fire on every pointermove; we only need
      // ~30Hz to feel live, and the getBoundingClientRect()s below are
      // not free.
      const now = performance.now()
      if (now - lastEmitRef.current < HOVER_THROTTLE_MS) return
      lastEmitRef.current = now

      const tools = p.tools ?? []
      const color = p.color
      const sourceId = p.cellId

      // Find the source cell — first match by data-cell-id (we'll
      // look up by cellId stored as a CellContext id; fallback: use
      // any cell with data-center-cell + closest to mouse).
      // Simpler: query all .cell elements and pick the one currently
      // hovered (matches :hover state).
      const allCells = Array.from(document.querySelectorAll('[data-cell-type]')) as HTMLElement[]
      const hovered = allCells.find((el) => el.matches(':hover'))
      if (!hovered) return

      const fromRect = hovered.getBoundingClientRect()
      const fromX = fromRect.left + fromRect.width / 2
      const fromY = fromRect.top + fromRect.height / 2

      // Find affinity targets — cells with shared color or shared
      // tool (we cannot easily read tools from DOM, so use color
      // attribute as the simpler heuristic + cells in the same
      // *visible row* as the source for "row affinity").
      const newLines: Line[] = []
      const rowSlice = hovered.dataset.stripRow
      allCells.forEach((cell, idx) => {
        if (cell === hovered) return
        // Same strip row → these cells visually sit on the payline
        // alongside the hovered one — connect them.
        const isSameRow = rowSlice && cell.dataset.stripRow === rowSlice
        // Same per-type glow (fallback affinity proxy)
        const sameType = cell.dataset.cellType === hovered.dataset.cellType
        if (!isSameRow && !sameType) return

        const r = cell.getBoundingClientRect()
        const toX = r.left + r.width / 2
        const toY = r.top + r.height / 2
        // V7.2 — cap reduced from 6 → 4 lines so the canvas reads
        // immediately, doesn't wash out the active hover target.
        if (newLines.length >= MAX_LINES) return
        newLines.push({
          id: `${sourceId ?? 'src'}-${idx}`,
          fromX, fromY, toX, toY,
          color: color || cssGlowFor(hovered),
        })
      })
      void tools
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current)
      setLines(newLines)
    })

    const offEnd = bus.on('custom:cell:hover:end', () => {
      // Fade out via opacity; clear after transition
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = window.setTimeout(() => setLines([]), 360)
    })

    // V7.2 — perf pressure gate: serious/critical → suspend until
    // we recover. Lines are an idle-loop ornament; nothing breaks
    // when they go quiet during heavy spin sequences.
    const offPerf = bus.on('custom:perf:pressure' as 'custom:perf:pressure', (p: { level: string }) => {
      const lvl = p?.level
      const next = lvl === 'serious' || lvl === 'critical'
      if (next !== suspendedRef.current) {
        suspendedRef.current = next
        if (next) setLines([])
      }
    })

    // V7.2 — clear on spin start so dashed flow lines never fight the
    // GSAP reel-strip animation for attention.
    const offSpin = bus.on('slot:spin:start', () => {
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current)
      setLines([])
    })

    return () => {
      offStart()
      offEnd()
      offPerf()
      offSpin()
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current)
    }
  }, [isMobile])

  if (lines.length === 0) return null

  return (
    <svg
      className={styles.svg}
      aria-hidden="true"
      width="100%"
      height="100%"
    >
      {lines.map((ln) => {
        // Curved cubic bezier — bows the line outward for organic feel
        const midX = (ln.fromX + ln.toX) / 2
        const midY = (ln.fromY + ln.toY) / 2
        const dx = ln.toX - ln.fromX
        const dy = ln.toY - ln.fromY
        const len = Math.sqrt(dx * dx + dy * dy)
        // Perpendicular offset (rotated 90deg) for the bezier control
        const offset = Math.min(60, len * 0.18)
        const cx = midX + (-dy / len) * offset
        const cy = midY + (dx / len) * offset
        const path = `M ${ln.fromX} ${ln.fromY} Q ${cx} ${cy} ${ln.toX} ${ln.toY}`
        return (
          <g key={ln.id}>
            {/* Outer glow stroke — wider, blurred */}
            <path
              d={path}
              fill="none"
              stroke={ln.color}
              strokeWidth={4}
              strokeOpacity={0.25}
              filter="url(#cnxBlur)"
              className={styles.glow}
            />
            {/* Inner sharp stroke */}
            <path
              d={path}
              fill="none"
              stroke={ln.color}
              strokeWidth={1.4}
              strokeOpacity={0.85}
              strokeDasharray="6 5"
              className={styles.line}
            />
            {/* Endpoint dot at target */}
            <circle
              cx={ln.toX}
              cy={ln.toY}
              r={3}
              fill={ln.color}
              opacity={0.7}
              className={styles.endpoint}
            />
          </g>
        )
      })}
      <defs>
        <filter id="cnxBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
    </svg>
  )
}

/** Read --cell-glow CSS var from cell (fallback white) */
function cssGlowFor(el: HTMLElement): string {
  const v = getComputedStyle(el).getPropertyValue('--cell-glow').trim()
  return v || '#ffffff'
}

export default CabinetConnectionLines
