/**
 * SectionStrategy — pluggable per-section column assembly contract.
 *
 * Replaces the 5-way `if (secId === ...)` branch that lived inside
 * SlotMachine.tsx. Each section now ships a strategy file that
 * implements `assemble(centerIdx) → CellData[][]` over its own
 * source data plus an optional `rowExcitement(itemIdx)` for the
 * anticipation engine (P0.3).
 *
 * Adding a new section is now a contained 40-line file:
 *
 *   import type { SectionStrategy } from './strategy'
 *   export const myStrategy: SectionStrategy = {
 *     items: MY_DATA,
 *     assemble(centerIdx) { … return cols }
 *   }
 *
 * Then register in sections/index.ts. Zero edits to SlotMachine.tsx.
 */

import type { CellData, SectionId } from '../../../types'

export interface SectionStrategy {
  /** Number of items in the section's source data. */
  itemCount: number
  /** Build the 7×N (rows × cols) cell grid centered on `centerIdx`. */
  assemble(centerIdx: number): CellData[][]
  /**
   * Optional excitement scorer — drives anticipation reels + slot:win
   * type bucketing. Returns 0..1. Sections without a meaningful win
   * condition omit this and inherit a constant 0.
   */
  rowExcitement?(itemIdx: number): number
}

/** Strip rows visible in the reel grid (3 visible + 4 buffer). */
export const STRIP_ROWS = 7
/** Half-window — center cell sits at index `half`. */
export const HALF = 3

/** Modulo wrap — handles negative indices into a positive cyclic index. */
export function wrap<T>(arr: readonly T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length]!
}

/** Compute the wrapped item index at strip row k for a given center. */
export function rowItemIndex(arrLen: number, centerIdx: number, k: number): number {
  return ((centerIdx - HALF + k) % arrLen + arrLen) % arrLen
}

/** Strategy registry keyed by SectionId — the SlotMachine consults this. */
export type StrategyRegistry = Readonly<Record<SectionId, SectionStrategy>>
