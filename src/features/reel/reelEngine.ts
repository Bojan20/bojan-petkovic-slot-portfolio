/**
 * Reel Engine — utilities for the slot reel
 */

// ============================================================
// CONSTANTS
// ============================================================

export const REEL_COLS = 5
export const REEL_ROWS = 3
export const CELLS_PER_REEL = 20
export const REEL_VISIBLE = 3       // center + 1 above + 1 below
export const STRIP_BUFFER = 2       // extra cells above and below
export const TOTAL_STRIP_CELLS = 7  // REEL_VISIBLE + STRIP_BUFFER * 2

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
 * Fisher-Yates shuffle — creates a new shuffled array without mutating original.
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
export function buildReelStrip<T>(cells: readonly T[]): T[] {
  if (cells.length === 0) return []

  const copies = Math.ceil(CELLS_PER_REEL / cells.length)
  const expanded: T[] = []
  for (let i = 0; i < copies; i++) {
    expanded.push(...cells)
  }
  return shuffleCells(expanded).slice(0, CELLS_PER_REEL)
}
