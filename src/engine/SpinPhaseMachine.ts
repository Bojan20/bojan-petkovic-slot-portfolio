/**
 * SpinPhaseMachine — pure-function reducer for the slot spin lifecycle.
 *
 * Extracts the implicit phase machine that lives inside SlotMachine.tsx
 * into a deterministic `transition(state, event)` function. The
 * extraction enables:
 *   • State-matrix unit tests (every from→to permutation, valid +
 *     invalid) as a regression gate
 *   • Documentation of the canonical phase contract
 *   • Future re-use by tools that simulate spin sequences (e.g. the
 *     promo-reel builder under tools/)
 *
 * SlotMachine.tsx currently owns the phase via Zustand setSpinPhase().
 * It can adopt this reducer incrementally — the existing setSpinPhase
 * calls map 1:1 to events here.
 *
 * Phase contract:
 *
 *   idle ──spin─▶ windup ──tick(140ms)─▶ spinning
 *                                          │
 *                                          │ tick(560..1140+anticipation)
 *                                          ▼
 *                                       landing ──tick(80ms)─▶ snapping
 *                                                                │
 *                                                                │ tick(58ms × 8 keyframes)
 *                                                                ▼
 *                                                              landed
 *                                                                │
 *                                                                │ paylineDismiss
 *                                                                ▼
 *                                                              idle
 *
 * Invalid transitions are no-ops (return the same state) so callers
 * can fire events at safe times without checking phase first. The
 * reducer never throws.
 */

import type { SpinPhase } from '../types'

export type SpinEvent =
  | { type: 'spin' }              // user pressed SPIN
  | { type: 'beginSpinning' }     // windup elapsed → start GSAP infinite tween
  | { type: 'columnLanded' }      // a column has reached its final cell
  | { type: 'beginSnapping' }     // landing pulse done → multi-bounce starts
  | { type: 'snapComplete' }      // last keyframe of snap finished
  | { type: 'paylineDismiss' }    // user closed payline takeover → unlock
  | { type: 'reset' }             // hard reset (HMR, snapshot restore)

/**
 * Pure phase reducer. Given current phase + an event, returns the
 * next phase. Invalid transitions return the same phase unchanged.
 */
export function transition(phase: SpinPhase, event: SpinEvent): SpinPhase {
  if (event.type === 'reset') return 'idle'

  switch (phase) {
    case 'idle':
      if (event.type === 'spin') return 'windup'
      return phase

    case 'windup':
      if (event.type === 'beginSpinning') return 'spinning'
      return phase

    case 'spinning':
      if (event.type === 'columnLanded') return 'landing'
      return phase

    case 'landing':
      if (event.type === 'beginSnapping') return 'snapping'
      // A second column landing while we're still in 'landing' is
      // expected (5 reels stagger) — stay in landing.
      if (event.type === 'columnLanded') return 'landing'
      return phase

    case 'snapping':
      if (event.type === 'snapComplete') return 'landed'
      return phase

    case 'landed':
      if (event.type === 'paylineDismiss') return 'idle'
      // A new spin pressed while still in landed (impatient user) —
      // allow the transition; payline takeover cleanup must run first
      // but that's the caller's responsibility (block at UI level).
      if (event.type === 'spin') return 'windup'
      return phase

    default:
      return phase
  }
}

/**
 * True if the phase represents an active animation that should
 * block secondary spin presses. Exposed so the SpinButton can
 * disable itself without re-implementing the rule.
 */
export function isSpinLocked(phase: SpinPhase): boolean {
  return phase !== 'idle' && phase !== 'landed'
}

/** True if the phase is in the "result is showing" state. */
export function isLanded(phase: SpinPhase): boolean {
  return phase === 'landed'
}
