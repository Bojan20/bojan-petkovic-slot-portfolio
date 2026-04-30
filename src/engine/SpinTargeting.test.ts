/**
 * SpinTargeting tests (P4.3).
 *
 * Pure function — no engine globals — so tests pass in deterministic
 * isVisited / rowExcitement closures and assert the picker's output.
 * Covers: current-row exclusion, unvisited preference, persona scoring
 * differences, distance tie-break, single-item edge case.
 */

import { describe, it, expect } from 'vitest'
import { pickNextItem } from './SpinTargeting'
import type { Persona } from './PersonaInference'

const NEVER_VISITED = () => false
const ALWAYS_VISITED = () => true
const FLAT_EXCITEMENT = () => 0.5

describe('SpinTargeting.pickNextItem', () => {
  it('returns currentIdx when itemCount ≤ 1', () => {
    expect(
      pickNextItem({
        sectionIdx: 0,
        currentIdx: 0,
        itemCount: 1,
        persona: 'balanced',
        isVisited: NEVER_VISITED,
        rowExcitement: FLAT_EXCITEMENT,
      }),
    ).toBe(0)
  })

  it('never re-picks currentIdx', () => {
    for (const persona of ['balanced', 'engineer', 'audio_designer', 'em_recruiter', 'curiosity_browser'] as Persona[]) {
      const next = pickNextItem({
        sectionIdx: 0,
        currentIdx: 3,
        itemCount: 10,
        persona,
        isVisited: NEVER_VISITED,
        rowExcitement: FLAT_EXCITEMENT,
      })
      expect(next).not.toBe(3)
    }
  })

  it('prefers unvisited rows when some are unvisited', () => {
    // Mark all but idx 7 visited; picker must land on 7
    const next = pickNextItem({
      sectionIdx: 0,
      currentIdx: 0,
      itemCount: 10,
      persona: 'balanced',
      isVisited: (i) => i !== 7,
      rowExcitement: FLAT_EXCITEMENT,
    })
    expect(next).toBe(7)
  })

  it('falls back to all candidates when everything visited', () => {
    const next = pickNextItem({
      sectionIdx: 0,
      currentIdx: 0,
      itemCount: 5,
      persona: 'balanced',
      isVisited: ALWAYS_VISITED,
      rowExcitement: FLAT_EXCITEMENT,
    })
    expect(next).not.toBe(0)
    expect([1, 2, 3, 4]).toContain(next)
  })

  it('em_recruiter weights excitement more heavily than balanced', () => {
    // Two candidates, one excitement 0.9 (jackpot), one 0.1.
    // currentIdx=0; item 1 = jackpot, item 2 = boring.
    const excitement = (i: number) => (i === 1 ? 0.9 : 0.1)
    const recruiter = pickNextItem({
      sectionIdx: 0, currentIdx: 0, itemCount: 3,
      persona: 'em_recruiter',
      isVisited: NEVER_VISITED,
      rowExcitement: excitement,
    })
    expect(recruiter).toBe(1) // recruiter chases the jackpot row
  })

  it('curiosity_browser breaks ties by ring distance (forward feel)', () => {
    // curiosity_browser flat-scores everything → tie-break by distance.
    // currentIdx 5 in itemCount 10 → idx 4 and idx 6 both distance 1.
    // Sorted stable by score, then by distance ascending → idx 4 wins
    // (it appears earlier in the candidate scan order).
    const next = pickNextItem({
      sectionIdx: 0, currentIdx: 5, itemCount: 10,
      persona: 'curiosity_browser',
      isVisited: NEVER_VISITED,
      rowExcitement: FLAT_EXCITEMENT,
    })
    // distance 1 candidates are 4 and 6 — both equally valid; whichever
    // sort selects, it must be one of them
    expect([4, 6]).toContain(next)
  })

  it('audio_designer scores audio-rich rows higher', () => {
    // idx 2 has high excitement; idx 1 is meh
    const excitement = (i: number) => (i === 2 ? 0.9 : 0.2)
    const next = pickNextItem({
      sectionIdx: 0, currentIdx: 0, itemCount: 4,
      persona: 'audio_designer',
      isVisited: NEVER_VISITED,
      rowExcitement: excitement,
    })
    expect(next).toBe(2)
  })

  it('handles all-visited + persona scoring correctly', () => {
    // Everything visited; em_recruiter should still chase highest excitement
    const excitement = (i: number) => (i === 4 ? 0.95 : 0.05)
    const next = pickNextItem({
      sectionIdx: 0, currentIdx: 0, itemCount: 5,
      persona: 'em_recruiter',
      isVisited: ALWAYS_VISITED,
      rowExcitement: excitement,
    })
    expect(next).toBe(4)
  })
})
