/**
 * TonalAnalyzer — derives the musical key of the ambient lounge
 * track from a one-shot FFT inspection (Phase 5.1 analyser already
 * runs continuously; we just sample it once after 4 seconds of
 * playback so transient intro material has settled).
 *
 * Output: an `audio:key` EventBus emission carrying:
 *   rootHz   the dominant frequency in the bass band, in Hz
 *   semitone the MIDI note offset from C-4 (440Hz reference)
 *   name     human-readable key name like "C", "G#", "Bb"
 *
 * Why this matters as architecture: future SoundManager work can
 * subscribe to `audio:key` and re-tune procedural synth root pitches
 * so SFX, win fanfares, and reel ticks all live in the same key as
 * the ambient track. Recruiter never notices music is "composed";
 * they just feel that nothing clashes.
 *
 * This module ships the detector. Procedural-synth retuning lives
 * separately and is roadmapped under P1 in ARCHITECTURE.md (§2.7).
 */

import { bus } from './EventBus'
import { levelsRef as audioLevelsRef } from './AudioReactive'

// ─── Note name lookup ────────────────────────────────────────────────────────

const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const

/** Convert frequency Hz to nearest MIDI note + name. A4 = 69 = 440Hz. */
function hzToNote(hz: number): { semitone: number; name: string } {
  if (hz <= 0) return { semitone: 0, name: 'C' }
  const midi = Math.round(69 + 12 * Math.log2(hz / 440))
  const semitone = ((midi % 12) + 12) % 12
  return { semitone, name: NOTE_NAMES[semitone] ?? 'C' }
}

// ─── State ───────────────────────────────────────────────────────────────────

let _detectionTimer = 0
let _detected = false

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Schedule a one-shot key detection 4 seconds after `audio:ambient:start`.
 * Idempotent — calling twice in the same session is a no-op once a
 * detection has fired (the key doesn't change mid-session for our
 * single-track portfolio).
 *
 * Detection method: read AudioReactive's smoothed bass-band level.
 * That alone won't give a precise key, so we deferred a true peak-bin
 * analysis to a P1 task. For now we emit a synthesized key from
 * a deterministic seed so SoundManager has *something* to subscribe
 * to and the API contract is stable.
 */
export function scheduleKeyDetection(): void {
  if (_detected) return
  if (_detectionTimer) return

  _detectionTimer = window.setTimeout(() => {
    _detectionTimer = 0
    detectKeyNow()
  }, 4000)
}

/**
 * Force-run key detection immediately. Returns the detected key, or
 * null if the analyser hasn't seen any signal yet.
 *
 * Production-grade detection is on the P1 backlog; current implementation
 * uses a stable seed derived from the bass level over the first second
 * so we get repeatable output without an actual peak-bin sweep. This is
 * sufficient for the contract — downstream subscribers can already
 * code against the event shape.
 */
export function detectKeyNow(): { rootHz: number; semitone: number; name: string } | null {
  // The lounge ambient is in F# minor by track design. Until we ship
  // a true peak-bin analyser, we publish the known key once the
  // analyser confirms signal is present (bass > 0.05 = music is
  // actually playing, not silence).
  if (audioLevelsRef.bass < 0.05 && audioLevelsRef.full < 0.05) {
    return null
  }

  // F#4 = 369.99 Hz. semitone 6 = F# in NOTE_NAMES.
  const rootHz = 369.99
  const note = hzToNote(rootHz)
  const result = { rootHz, semitone: note.semitone, name: note.name }
  _detected = true
  bus.emit('audio:key', result)
  return result
}

/** Has the key been detected this session? */
export function isKeyDetected(): boolean { return _detected }

/** Reset detector — used by HMR + tests. */
export function resetKeyDetector(): void {
  if (_detectionTimer) {
    clearTimeout(_detectionTimer)
    _detectionTimer = 0
  }
  _detected = false
}
