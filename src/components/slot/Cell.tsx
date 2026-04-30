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

import { useCallback, useId, useMemo } from 'react'
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
  onGameCellClick?: (itemIndex: number) => void
}

export function Cell({ data, height, colIndex, onGameCellClick }: CellProps) {
  const cellId = useId()
  const isCenter = data.center
  const cls = [
    styles.cell,
    isCenter ? styles.center : styles.dim,
    data.type === 'game' ? styles.gameCell : '',
  ].filter(Boolean).join(' ')

  const handleClick = () => {
    // P3.7 — audio designer's portfolio MUST sound on click. Plays a
    // small UI tick on every cell interaction. SoundManager swallows
    // when AudioContext isn't unlocked yet, so pre-tap is silent.
    // sfx_rail_tick — short metallic click, registered in SoundManager.
    try { playSynthById('sfx_rail_tick', 0.55) } catch { /* ignore */ }
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
        {...(isCenter ? { 'data-center-cell': '' } : {})}
      >
        <CellBackground />
        <CellContent />
      </div>
    </CellContext.Provider>
  )
}

export default Cell
