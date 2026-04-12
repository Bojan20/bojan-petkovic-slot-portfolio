/**
 * Reel Engine Tests
 */

import { describe, it, expect } from 'vitest'
import {
  shuffleCells,
  buildReelStrip,
  REEL_COLS,
  REEL_ROWS,
  CELLS_PER_REEL,
} from './reelEngine'
import type { ReelCell } from '../../types'

const mockCell = (title: string): ReelCell => ({
  icon: '🎮',
  title,
  role: 'Test',
  year: '2024',
  tags: ['test'],
  category: 'games',
  hasDemo: false,
  description: 'Test cell',
})

describe('shuffleCells', () => {
  it('returns array of same length', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleCells(input)
    expect(result).toHaveLength(input.length)
  })

  it('contains all original elements', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleCells(input)
    expect(result.sort()).toEqual(input.sort())
  })

  it('does not mutate original array', () => {
    const input = [1, 2, 3]
    const copy = [...input]
    shuffleCells(input)
    expect(input).toEqual(copy)
  })
})

describe('buildReelStrip', () => {
  it('returns empty array for empty input', () => {
    expect(buildReelStrip([])).toEqual([])
  })

  it('returns CELLS_PER_REEL cells', () => {
    const cells = [mockCell('A'), mockCell('B'), mockCell('C')]
    const strip = buildReelStrip(cells)
    expect(strip).toHaveLength(CELLS_PER_REEL)
  })

  it('works with single cell', () => {
    const strip = buildReelStrip([mockCell('Only')])
    expect(strip).toHaveLength(CELLS_PER_REEL)
    expect(strip.every((c) => c.title === 'Only')).toBe(true)
  })
})

describe('constants', () => {
  it('has 5 columns', () => {
    expect(REEL_COLS).toBe(5)
  })

  it('has 3 rows', () => {
    expect(REEL_ROWS).toBe(3)
  })

  it('has 20 cells per reel', () => {
    expect(CELLS_PER_REEL).toBe(20)
  })
})
