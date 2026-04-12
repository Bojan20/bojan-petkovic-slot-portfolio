/**
 * Reel Engine — GSAP-powered slot reel animation
 *
 * 5-column, 3-row slot grid. Each column spins independently with staggered
 * timing (WoO style): col0 lands first, col4 lands last.
 *
 * Spin phases:
 *   idle → accelerating → full-speed → decelerating → bouncing → landed
 *
 * Cell data is shuffled per spin. Center row = "winning" line.
 */

import gsap from 'gsap'
import type { ReelCell, SpinPhase } from '../../types'

// ============================================================
// CONSTANTS (WoO proportions)
// ============================================================

export const REEL_COLS = 5
export const REEL_ROWS = 3
export const CELLS_PER_REEL = 20 // Total cells in the virtual strip

/** Stagger delay between columns landing (ms) */
export const COL_STAGGER_MS = 180

/** Total spin duration per column (ms) */
export const SPIN_DURATION_MS = 1800

/** Bounce overshoot distance (px) */
export const BOUNCE_OVERSHOOT = 12

// ============================================================
// SHUFFLE UTILITY
// ============================================================

/**
 * Fisher-Yates shuffle — creates a new shuffled array.
 */
export function shuffleCells<T>(arr: readonly T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]!
    result[i] = result[j]!
    result[j] = temp
  }
  return result
}

/**
 * Build a virtual reel strip from available cells.
 * Ensures at least CELLS_PER_REEL entries by repeating + shuffling.
 */
export function buildReelStrip(cells: readonly ReelCell[]): ReelCell[] {
  if (cells.length === 0) return []

  const copies = Math.ceil(CELLS_PER_REEL / cells.length)
  const expanded: ReelCell[] = []
  for (let i = 0; i < copies; i++) {
    expanded.push(...cells)
  }
  return shuffleCells(expanded).slice(0, CELLS_PER_REEL)
}

// ============================================================
// GSAP SPIN ANIMATION
// ============================================================

interface SpinColumnOpts {
  /** The DOM element wrapping this column's cells */
  columnEl: HTMLElement
  /** Height of a single cell (px) */
  cellHeight: number
  /** Column index (0-4) for stagger */
  colIndex: number
  /** Callback when this column lands */
  onLand?: (colIndex: number) => void
  /** Callback on each "tick" (cell passing center) */
  onTick?: () => void
  /** Phase change callback */
  onPhaseChange?: (phase: SpinPhase) => void
}

/**
 * Animate a single reel column spin using GSAP.
 * Returns a GSAP timeline that can be killed.
 */
export function spinColumn(opts: SpinColumnOpts): gsap.core.Timeline {
  const { columnEl, cellHeight, colIndex, onLand, onPhaseChange } = opts

  const totalTravel = cellHeight * CELLS_PER_REEL
  const stagger = colIndex * (COL_STAGGER_MS / 1000)
  const duration = SPIN_DURATION_MS / 1000

  const tl = gsap.timeline({
    delay: stagger,
    onStart: () => onPhaseChange?.('accelerating'),
    onComplete: () => {
      onPhaseChange?.('landed')
      onLand?.(colIndex)
    },
  })

  // Phase 1: Accelerate
  tl.to(columnEl, {
    y: `-=${cellHeight * 3}`,
    duration: duration * 0.15,
    ease: 'power2.in',
    onStart: () => onPhaseChange?.('accelerating'),
  })

  // Phase 2: Full speed
  tl.to(columnEl, {
    y: `-=${totalTravel}`,
    duration: duration * 0.55,
    ease: 'none',
    onStart: () => onPhaseChange?.('full-speed'),
  })

  // Phase 3: Decelerate + overshoot
  tl.to(columnEl, {
    y: `-=${cellHeight * 2 + BOUNCE_OVERSHOOT}`,
    duration: duration * 0.2,
    ease: 'power3.out',
    onStart: () => onPhaseChange?.('bouncing'),
  })

  // Phase 4: Bounce back
  tl.to(columnEl, {
    y: `+=${BOUNCE_OVERSHOOT}`,
    duration: duration * 0.1,
    ease: 'elastic.out(1, 0.3)',
  })

  return tl
}

/**
 * Spin all 5 columns. Returns master timeline.
 */
export function spinAllColumns(
  columnEls: HTMLElement[],
  cellHeight: number,
  callbacks: {
    onColumnLand?: (colIndex: number) => void
    onAllLanded?: () => void
    onPhaseChange?: (colIndex: number, phase: SpinPhase) => void
  } = {}
): gsap.core.Timeline {
  const master = gsap.timeline({
    onComplete: callbacks.onAllLanded,
  })

  columnEls.forEach((el, i) => {
    const colTl = spinColumn({
      columnEl: el,
      cellHeight,
      colIndex: i,
      onLand: callbacks.onColumnLand,
      onPhaseChange: (phase) => callbacks.onPhaseChange?.(i, phase),
    })
    master.add(colTl, 0) // All start at time 0, stagger is internal
  })

  return master
}
