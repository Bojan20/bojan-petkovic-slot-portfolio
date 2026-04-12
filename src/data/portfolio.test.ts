/**
 * Portfolio Data Tests
 */

import { describe, it, expect } from 'vitest'
import {
  TABS,
  PROJECT_CELLS,
  SKILL_CELLS,
  ABOUT_CELLS,
  CAREER_CELLS,
  ALL_CELLS,
  getCellsByCategory,
} from './portfolio'

describe('portfolio data', () => {
  it('has 5 tabs', () => {
    expect(TABS).toHaveLength(5)
  })

  it('has 8 project cells', () => {
    expect(PROJECT_CELLS).toHaveLength(8)
  })

  it('has 6 skill cells', () => {
    expect(SKILL_CELLS).toHaveLength(6)
  })

  it('has 5 about cells', () => {
    expect(ABOUT_CELLS).toHaveLength(5)
  })

  it('has 4 career cells', () => {
    expect(CAREER_CELLS).toHaveLength(4)
  })

  it('ALL_CELLS is the sum of all categories', () => {
    expect(ALL_CELLS).toHaveLength(
      PROJECT_CELLS.length + SKILL_CELLS.length + ABOUT_CELLS.length + CAREER_CELLS.length
    )
  })

  it('every cell has required fields', () => {
    for (const cell of ALL_CELLS) {
      expect(cell.icon).toBeTruthy()
      expect(cell.title).toBeTruthy()
      expect(cell.category).toBeTruthy()
      expect(cell.tags.length).toBeGreaterThan(0)
    }
  })
})

describe('getCellsByCategory', () => {
  it('returns all cells for "all"', () => {
    expect(getCellsByCategory('all')).toEqual(ALL_CELLS)
  })

  it('returns only games for "games"', () => {
    const games = getCellsByCategory('games')
    expect(games.every((c) => c.category === 'games')).toBe(true)
    expect(games).toHaveLength(PROJECT_CELLS.length)
  })

  it('returns empty for unknown category', () => {
    expect(getCellsByCategory('nonexistent')).toHaveLength(0)
  })
})
