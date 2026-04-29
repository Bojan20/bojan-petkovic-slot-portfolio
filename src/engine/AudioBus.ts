/**
 * AudioBus — cinematic audio cue scheduler.
 *
 * Subscribes to `custom:transition:cue` events from TransitionDirector
 * and fires registered audio callbacks with optional negative offset
 * (J-cut: sound leads picture by 80–150ms). Each cue label maps to
 * one or many audio handlers; multiple subsystems can register for
 * the same label (e.g. SoundManager synth + SpatialAudio pan).
 *
 * J-cut implementation:
 *   - Director emits `custom:transition:cue { label, leadMs: 120 }`
 *     BEFORE moving the picture.
 *   - AudioBus invokes registered callbacks with no extra delay
 *     (the lead time is achieved by emitting the cue BEFORE the
 *     picture timeline kicks).
 *   - Callbacks themselves should be synchronous (audio start /
 *     synth play) so the lead is preserved.
 *
 * L-cut: keep audio playing across a phase boundary by NOT firing
 *   stop on transition. Sound bleeds; picture cuts.
 */

import { bus } from './EventBus'
import type { TransitionLabel } from './TransitionDirector'

type CueHandler = (label: TransitionLabel, leadMs: number) => void

const _handlers = new Map<TransitionLabel, Set<CueHandler>>()
let _started = false
let _unsubscribe: (() => void) | null = null

/**
 * Register a handler for a transition cue label. Returns an
 * unsubscribe function. Handlers fire synchronously so audio start
 * preserves the J-cut lead.
 */
export function onAudioCue(label: TransitionLabel, fn: CueHandler): () => void {
  let set = _handlers.get(label)
  if (!set) {
    set = new Set()
    _handlers.set(label, set)
  }
  set.add(fn)
  return () => {
    set?.delete(fn)
    if (set?.size === 0) _handlers.delete(label)
  }
}

/** Start the AudioBus. Idempotent. */
export function startAudioBus(): void {
  if (_started) return
  _started = true

  _unsubscribe = bus.on('custom:transition:cue', (p) => {
    const payload = p as { label: TransitionLabel; leadMs: number }
    const set = _handlers.get(payload.label)
    if (!set) return
    for (const fn of set) {
      try {
        fn(payload.label, payload.leadMs)
      } catch (err) {
        console.warn('[AudioBus] cue handler failed for', payload.label, err)
      }
    }
  })
}

export function stopAudioBus(): void {
  if (!_started) return
  _started = false
  _unsubscribe?.()
  _unsubscribe = null
  _handlers.clear()
}

export function isAudioBusStarted(): boolean { return _started }
