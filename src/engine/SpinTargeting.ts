/**
 * SpinTargeting — persona-driven NEXT REEL picker.
 *
 * Old behavior: SPIN advanced `(currentIdx + 1) % length`. Linear,
 * deterministic, but boring — and worse, it would happily land on
 * a row the recruiter has already deep-dived. The cabinet had no
 * memory of where the user had been.
 *
 * V2 behavior (P4.3): SPIN consults two CORTEX modules and picks
 * the *most useful next row* for THIS recruiter:
 *
 *   • PersonaInference (P1.8) — am I looking at an audio designer
 *     hire? An EM/recruiter? An engineer? Different next-row
 *     priorities for each.
 *   • CellMemory (P0.2) — has this row already been the center cell
 *     this session? If so, deprioritize. Show new ground first.
 *
 * The picker is a pure function so it's unit-testable in isolation
 * (no engine globals, no React, no Zustand). The caller passes in
 * persona + visited probe + excitement scorer; we return the index.
 *
 * Hierarchy:
 *   1. Never re-pick the current row (must produce motion).
 *   2. If unvisited rows exist, pick from them.
 *   3. Score remaining candidates by persona (excitement-weighted).
 *   4. Tie-break by closer linear distance to current — so the spin
 *      "feels" like a forward step, not a teleport, when scores match.
 *
 * Why not random: a random walk loses the "machine knows you" feeling
 * that's the entire point of P0.2 + P1.8 existing. Persona-driven
 * progression is the differentiator.
 */

import type { Persona } from './PersonaInference'

export interface PickNextOpts {
  /** Section index (0-4). Carried for future per-section overrides. */
  sectionIdx: number
  /** Currently centered row. Always excluded from candidate pool. */
  currentIdx: number
  /** Total items in the section. Wraps modulo. */
  itemCount: number
  /** Inferred recruiter persona. Defaults to 'balanced' upstream. */
  persona: Persona
  /** Returns true if this row's cell key is already in CellMemory. */
  isVisited: (idx: number) => boolean
  /** Maps idx → 0..1 excitement score (jackpot rows ≥ 0.85). */
  rowExcitement: (idx: number) => number
}

/**
 * Persona-specific weighting for a candidate row.
 *
 * audio_designer → big multiplier on excitement (audio-rich projects
 *                  carry the highest excitement scores in PROJECTS data)
 * engineer       → flatter multiplier; engineers value depth across
 *                  the catalog, not just headline projects
 * em_recruiter   → strongest excitement weight; recruiters want
 *                  the showstoppers fast (outcomes, jackpot rows)
 * curiosity_browser → flat — they explore breadth; any unvisited is good
 * balanced       → moderate weight (default before WARMUP_MS elapses)
 */
function scoreRow(
  idx: number,
  persona: Persona,
  rowExcitement: (i: number) => number,
): number {
  const e = rowExcitement(idx)
  switch (persona) {
    case 'audio_designer':
      return e * 1.5 + 0.1
    case 'engineer':
      return e * 1.0 + 0.3
    case 'em_recruiter':
      return e * 2.0
    case 'curiosity_browser':
      return 0.5
    case 'balanced':
    default:
      return e * 0.7 + 0.4
  }
}

/** Modular distance from a → b in a ring of length n (always positive). */
function ringDist(a: number, b: number, n: number): number {
  const d = ((b - a) % n + n) % n
  return Math.min(d, n - d)
}

/**
 * Pick the next reel destination. Pure — no side effects.
 *
 * Returns the same `currentIdx` ONLY if the section has 0 or 1 items
 * (the spin engine treats that as "nothing to land on"). Otherwise
 * the returned index is guaranteed to differ from currentIdx.
 */
export function pickNextItem(opts: PickNextOpts): number {
  const { currentIdx, itemCount, persona, isVisited, rowExcitement } = opts
  if (itemCount <= 1) return currentIdx

  // Build candidate pool — never the current row
  const candidates: number[] = []
  for (let i = 0; i < itemCount; i++) {
    if (i !== currentIdx) candidates.push(i)
  }

  // Prefer unvisited; fall back to all candidates if everything seen
  const unvisited = candidates.filter((i) => !isVisited(i))
  const pool = unvisited.length > 0 ? unvisited : candidates

  // Score + sort. Higher score wins; ties broken by smaller ring
  // distance so the spin feels forward-stepping, not random.
  const scored = pool.map((i) => ({
    idx: i,
    score: scoreRow(i, persona, rowExcitement),
    dist: ringDist(currentIdx, i, itemCount),
  }))
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.dist - b.dist
  })

  return scored[0]!.idx
}
