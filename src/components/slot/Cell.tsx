/**
 * Cell — orchestrator over the compound cell parts (post-refactor).
 *
 * This component preserves the public API the rest of the codebase
 * depends on (`<Cell data height onGameCellClick />`) but internally
 * composes from `cell/CellContext`, `cell/CellBackground`, and
 * `cell/CellContent` — each of which can be reused independently
 * by future cell variants.
 *
 * The 3D perspective tilt + cursor spotlight CSS-var bookkeeping
 * stays here because it's a *Shell* concern (the wrapper element
 * owns the geometry), not a Background or Content concern.
 *
 * For custom variants that want a different content arrangement
 * (e.g. an animated WebP demo), import `CellContext` and the
 * subcomponents directly from `./cell` and assemble manually.
 */

import { useCallback, useId, useMemo, useRef, useState } from 'react'
import type { CellData } from '../../types'
import styles from './Cell.module.css'
import { CellContext } from './cell/CellContext'
import { CellBackground } from './cell/CellBackground'
import { CellContent } from './cell/CellContent'
import { bus, playSynthById } from '../../engine'

interface CellProps {
  data: CellData
  height: number
  colIndex?: number
  /** V3.2 — strip row index (0-6). cell[3] is the centered row; rows
   *  2 and 4 are top/bottom edges that get cylindrical rotateX. */
  stripRow?: number
  onGameCellClick?: (itemIndex: number) => void
}

/**
 * V3.1 — center-only type tag. Shows the cell type in a small pill at
 * top-left of the focused (center) cell only. Off-row cells in the
 * same column are the same type, so showing the tag on every row
 * would be visual noise. Tag inherits per-type --cell-glow color.
 */
function tagLabel(type: string | undefined): string | null {
  switch (type) {
    case 'game':   return 'GAME'
    case 'scope':  return 'SCOPE'
    case 'tools':  return 'TOOLS'
    case 'demo':   return 'DEMO'
    case 'detail': return 'DETAIL'
    case 'work':   return 'WORK'
    case 'simple': return null
    default:       return null
  }
}

export function Cell({ data, height, colIndex, stripRow, onGameCellClick }: CellProps) {
  const cellId = useId()
  const isCenter = data.center
  // V4.2 — peel state. Set true for the brief moment between click
  // commit and onGameCellClick firing so the selected card visually
  // tilts forward while the others blur away.
  const [peeling, setPeeling] = useState(false)
  const peelTimerRef = useRef<number>(0)

  const cls = [
    styles.cell,
    isCenter ? styles.center : styles.dim,
    data.type === 'game' ? styles.gameCell : '',
    peeling ? styles.cellPeel : '',
  ].filter(Boolean).join(' ')

  const handleClick = () => {
    // P3.7 — audio designer's portfolio MUST sound on click. Plays a
    // small UI tick on every cell interaction. SoundManager swallows
    // when AudioContext isn't unlocked yet, so pre-tap is silent.
    // sfx_rail_tick — short metallic click, registered in SoundManager.
    try { playSynthById('sfx_rail_tick', 0.55) } catch { /* ignore */ }
    // V4.0 — emit cell click for the cinematic camera to react with
    // a punch-in. Also a hook for the cinematic peel below.
    bus.emit('custom:cell:click' as 'custom:cell:click', {
      type: data.type,
      isCenter,
      cellId,
    })

    // V4.2 — cinematic card select. Non-center game cells get a
    // brief "peel forward" animation + body[data-card-select] flag
    // that defocuses the rest of the grid. After 280ms the cell
    // calls onGameCellClick which kicks off the spin sequence.
    if (data.type === 'game' && !isCenter && data.itemIndex !== undefined) {
      setPeeling(true)
      document.body.setAttribute('data-card-select', 'active')
      if (peelTimerRef.current) window.clearTimeout(peelTimerRef.current)
      peelTimerRef.current = window.setTimeout(() => {
        document.body.removeAttribute('data-card-select')
        setPeeling(false)
        onGameCellClick?.(data.itemIndex!)
        peelTimerRef.current = 0
      }, 280)
      return
    }

    if (data.type === 'game' && data.itemIndex !== undefined) {
      onGameCellClick?.(data.itemIndex)
    }
  }

  // Stagger idle-breath delay per cell so the grid doesn't pulse
  // in unison — feels organic rather than mechanical.
  const breathDelay = useMemo(() => `-${(Math.abs(cellId.charCodeAt(2) ?? 0) % 46) / 10}s`, [cellId])

  // 3D perspective tilt — cursor position → rotateX/Y CSS vars consumed
  // by Cell.module.css `.cell:hover` rule. Per-cell handler is fine for
  // desktop; mobile uses touch which doesn't generate mousemove anyway.
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = ((e.clientX - rect.left) / rect.width - 0.5) * 2   // -1..+1
    const cy = ((e.clientY - rect.top) / rect.height - 0.5) * 2   // -1..+1
    e.currentTarget.style.setProperty('--cx', cx.toFixed(3))
    e.currentTarget.style.setProperty('--cy', cy.toFixed(3))
  }, [])

  const handleMouseEnter = useCallback(() => {
    // Broadcast affinity hover (P1.9) — other cells with shared tools
    // or matching project color pulse a highlight. Subscribers self-
    // cull (cells without overlap ignore the event).
    bus.emit('custom:cell:hover:start', {
      tools: data.tools ?? [],
      color: data.color,
      cellId,
    })
  }, [data.tools, data.color, cellId])

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--cx', '0')
    e.currentTarget.style.setProperty('--cy', '0')
    bus.emit('custom:cell:hover:end', { cellId })
  }, [cellId])

  // V3.1 — type tag for the center cell (GAME / SCOPE / TOOLS / DEMO …)
  const v3Tag = isCenter ? tagLabel(data.type) : null

  return (
    <CellContext.Provider value={{ data, isCenter }}>
      <div
        className={cls}
        style={{
          height: `${height}px`,
          boxSizing: 'border-box',
          ['--breath-delay' as string]: breathDelay,
        }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-cell-type={data.type}
        {...(colIndex !== undefined ? { 'data-col': String(colIndex) } : {})}
        {...(stripRow !== undefined ? { 'data-strip-row': String(stripRow) } : {})}
        {...(isCenter ? { 'data-center-cell': '' } : {})}
      >
        <CellBackground />

        {/* V3.1 — holographic conic rim. Idle invisible; on hover OR
            when the cell is centered, the conic gradient rotates
            once per 8s with per-type --cell-glow tint. */}
        <div className={styles.v3HoloRim} aria-hidden="true" />

        {/* V3.1 — center cell type tag. Tells the recruiter at a
            glance "this column = GAME" without dropping into the
            payline takeover. */}
        {v3Tag && (
          <div className={styles.v3CellTag} aria-hidden="true">
            {v3Tag}
          </div>
        )}

        <CellContent />
      </div>
    </CellContext.Provider>
  )
}

export default Cell
