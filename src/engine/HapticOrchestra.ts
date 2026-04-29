/**
 * HapticOrchestra — bus events → vibration patterns
 *
 * Independent of SoundManager (which has its own per-sound haptic
 * mapping driven by portfolioConfig). This subsystem orchestrates
 * vibration on APP-level events: boot tap, transitions, voice commands,
 * spin lifecycle, wins. Designed to give the device a felt cadence
 * that mirrors what the eye and ear are getting.
 *
 * Implementation: navigator.vibrate(patternMs[]). Most Android devices
 * support it; iOS does not (Safari hasn't shipped Vibration API). On
 * unsupported devices every call is a silent no-op — no errors thrown.
 *
 * User control: read isHapticEnabled() / setHapticEnabled(bool). The
 * setting persists in localStorage. Default ON for touch devices,
 * OFF for non-touch (vibration on a desktop is meaningless even if
 * a peripheral were to support it).
 *
 * Patterns are TIGHT and SHORT (most pulses < 80ms) — long bzzzz feels
 * cheap and drains battery. The "big" jackpot pattern below totals
 * ~720ms which is the longest we ever fire, and only on jackpot wins.
 */

import { bus } from './EventBus'

// ── Pattern library ─────────────────────────────────────────────────
// Numbers = vibrate ms / pause ms / vibrate ms / pause ms / ...
// (Standard navigator.vibrate format)
export const HAPTIC_PATTERNS = {
  // System / boot
  boot_tap:        [18],                            // light confirmation tap
  splash_enter:    [40, 30, 60],                    // double-pulse + tail
  shockwave:       [120, 50, 80],                   // bang + echo
  transition:     [25],                             // brief tick

  // Voice
  voice_listen_on: [12],                            // micro-tick
  voice_command:   [10, 18, 10],                    // triple micro-tick
  voice_listen_off:[8],

  // Spin lifecycle
  spin_windup:     [12, 16, 22, 14, 30],            // ramp into the spin
  reel_land:       [38],                            // single thud per column
  reel_land_last:  [28, 22, 60],                    // emphasized last column
  small_win:       [40, 40, 80],
  medium_win:      [60, 50, 120, 50, 80],
  big_win:         [80, 50, 160, 50, 120, 50, 200],
  jackpot:         [60, 40, 60, 40, 200, 80, 280, 100, 320],  // crescendo

  // Cell selection
  cell_focus:      [10],
} as const

export type HapticPattern = keyof typeof HAPTIC_PATTERNS

// ── State ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'bp-haptic-enabled'
let enabled = computeDefaultEnabled()
let cleanups: Array<() => void> = []
let started = false

function computeDefaultEnabled(): boolean {
  // Default ON for touch devices, OFF otherwise. User toggle overrides.
  if (typeof window === 'undefined') return false
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === '0') return false
    if (stored === '1') return true
  } catch { /* ignore */ }
  return matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false
}

/** Whether haptics are supported AND enabled. */
export function isHapticEnabled(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  return enabled
}

/** Persist user preference. */
export function setHapticEnabled(on: boolean): void {
  enabled = on
  try { window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0') } catch { /* ignore */ }
}

/**
 * Fire a named pattern. Safe to call on unsupported devices (no-op).
 * Use this directly for edge-case triggers; the bus subscribers below
 * cover the common app events automatically.
 */
export function vibrate(pattern: HapticPattern | number[]): void {
  if (!isHapticEnabled()) return
  const p = Array.isArray(pattern) ? pattern : HAPTIC_PATTERNS[pattern]
  if (!p) return
  try {
    navigator.vibrate(p as number[])
  } catch { /* ignore — some browsers throw on long arrays */ }
}

/**
 * Subscribe to standard app events and translate to haptics.
 * Idempotent — calling twice doesn't double-subscribe.
 * Call disposeHapticOrchestra() to tear down (HMR-safe).
 */
export function startHapticOrchestra(): void {
  if (started) return
  started = true

  // Boot lifecycle
  cleanups.push(bus.on('boot:tap', () => vibrate('boot_tap')))
  cleanups.push(bus.on('boot:complete', () => vibrate('transition')))

  // Splash → slot transition
  cleanups.push(bus.on('splash:enter', () => vibrate('splash_enter')))
  cleanups.push(bus.on('transition:shockwave', () => vibrate('shockwave')))

  // Spin lifecycle — windup at start, single thud per reel stop, escalated
  // pulse at slot:win.
  cleanups.push(bus.on('slot:spin:start', () => vibrate('spin_windup')))
  cleanups.push(bus.on('slot:reel:stop', () => vibrate('reel_land_last')))

  // Wins — type-aware escalation
  cleanups.push(bus.on('slot:win', (p) => {
    const t = p?.type
    if (t === 'jackpot')      vibrate('jackpot')
    else if (t === 'big')     vibrate('big_win')
    else if (t === 'medium')  vibrate('medium_win')
    else                       vibrate('small_win')
  }))

  // Voice control feedback
  cleanups.push(bus.on('voice:command:spin',    () => vibrate('voice_command')))
  cleanups.push(bus.on('voice:command:next',    () => vibrate('voice_command')))
  cleanups.push(bus.on('voice:command:back',    () => vibrate('voice_command')))
  cleanups.push(bus.on('voice:command:mute',    () => vibrate('voice_command')))
  cleanups.push(bus.on('voice:command:unmute',  () => vibrate('voice_command')))
  cleanups.push(bus.on('voice:command:jackpot', () => vibrate('jackpot')))

  // Item selection — section change handles both swipe + voice
  cleanups.push(bus.on('slot:section:change', () => vibrate('cell_focus')))
  cleanups.push(bus.on('slot:item:select', () => vibrate('cell_focus')))
}

export function disposeHapticOrchestra(): void {
  cleanups.forEach((fn) => fn())
  cleanups = []
  started = false
}
