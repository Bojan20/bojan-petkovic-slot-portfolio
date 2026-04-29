/**
 * SpinPhaseMachine state-matrix tests (P1.14).
 *
 * Exhaustive coverage of every (phase × event) permutation. Valid
 * transitions are asserted explicitly; invalid transitions are
 * collected once and asserted to all be no-ops. Any new event or
 * phase forces this matrix to update — the test fails fast on
 * inadvertent semantic drift.
 */

import { describe, it, expect } from 'vitest'
import {
  transition,
  isSpinLocked,
  isLanded,
  type SpinEvent,
} from './SpinPhaseMachine'
import type { SpinPhase } from '../types'

const PHASES: SpinPhase[] = ['idle', 'windup', 'spinning', 'landing', 'snapping', 'landed']
const EVENT_TYPES = [
  'spin',
  'beginSpinning',
  'columnLanded',
  'beginSnapping',
  'snapComplete',
  'paylineDismiss',
  'reset',
] as const

function ev(t: typeof EVENT_TYPES[number]): SpinEvent {
  return { type: t } as SpinEvent
}

describe('SpinPhaseMachine — valid transitions', () => {
  it('idle + spin → windup', () => {
    expect(transition('idle', ev('spin'))).toBe('windup')
  })
  it('windup + beginSpinning → spinning', () => {
    expect(transition('windup', ev('beginSpinning'))).toBe('spinning')
  })
  it('spinning + columnLanded → landing', () => {
    expect(transition('spinning', ev('columnLanded'))).toBe('landing')
  })
  it('landing + columnLanded → landing (stagger across 5 reels)', () => {
    expect(transition('landing', ev('columnLanded'))).toBe('landing')
  })
  it('landing + beginSnapping → snapping', () => {
    expect(transition('landing', ev('beginSnapping'))).toBe('snapping')
  })
  it('snapping + snapComplete → landed', () => {
    expect(transition('snapping', ev('snapComplete'))).toBe('landed')
  })
  it('landed + paylineDismiss → idle', () => {
    expect(transition('landed', ev('paylineDismiss'))).toBe('idle')
  })
  it('landed + spin → windup (impatient re-spin)', () => {
    expect(transition('landed', ev('spin'))).toBe('windup')
  })
})

describe('SpinPhaseMachine — reset is universal', () => {
  it('any phase + reset → idle', () => {
    for (const p of PHASES) {
      expect(transition(p, ev('reset'))).toBe('idle')
    }
  })
})

describe('SpinPhaseMachine — invalid transitions are no-ops', () => {
  // Whitelist of (phase, event) pairs that ARE valid — everything
  // else must return the same phase unchanged.
  const VALID = new Set([
    'idle:spin',
    'windup:beginSpinning',
    'spinning:columnLanded',
    'landing:columnLanded',
    'landing:beginSnapping',
    'snapping:snapComplete',
    'landed:paylineDismiss',
    'landed:spin',
    // reset is always valid (already covered above)
  ])

  it('every non-whitelisted (phase, event) returns the same phase', () => {
    for (const p of PHASES) {
      for (const e of EVENT_TYPES) {
        if (e === 'reset') continue            // covered separately
        if (VALID.has(`${p}:${e}`)) continue   // covered above
        const result = transition(p, ev(e))
        expect(result, `${p} + ${e} should be no-op`).toBe(p)
      }
    }
  })
})

describe('SpinPhaseMachine — selectors', () => {
  it('isSpinLocked returns true for active animation phases', () => {
    expect(isSpinLocked('idle')).toBe(false)
    expect(isSpinLocked('windup')).toBe(true)
    expect(isSpinLocked('spinning')).toBe(true)
    expect(isSpinLocked('landing')).toBe(true)
    expect(isSpinLocked('snapping')).toBe(true)
    expect(isSpinLocked('landed')).toBe(false)
  })

  it('isLanded only true on landed', () => {
    for (const p of PHASES) {
      expect(isLanded(p)).toBe(p === 'landed')
    }
  })
})

describe('SpinPhaseMachine — full happy-path sequence', () => {
  it('drives idle → windup → spinning → landing → snapping → landed → idle', () => {
    let p: SpinPhase = 'idle'
    p = transition(p, ev('spin'));            expect(p).toBe('windup')
    p = transition(p, ev('beginSpinning'));   expect(p).toBe('spinning')
    p = transition(p, ev('columnLanded'));    expect(p).toBe('landing')
    // Subsequent column lands stay in landing (4 more reels)
    p = transition(p, ev('columnLanded'));    expect(p).toBe('landing')
    p = transition(p, ev('columnLanded'));    expect(p).toBe('landing')
    p = transition(p, ev('beginSnapping'));   expect(p).toBe('snapping')
    p = transition(p, ev('snapComplete'));    expect(p).toBe('landed')
    p = transition(p, ev('paylineDismiss')); expect(p).toBe('idle')
  })
})
