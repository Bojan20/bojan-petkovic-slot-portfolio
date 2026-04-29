/**
 * SpeechAnnouncer — Cinematic casino-host voice over the portfolio
 *
 * Wraps Web Speech API synthesis (window.speechSynthesis) into a small
 * EventBus-driven announcer that calls out boot completion, section
 * changes, project selection, and wins. The effect is "the slot machine
 * has a voice" — recruiters arriving cold get an immediate sense of
 * stagecraft before they touch a single control.
 *
 * Design constraints:
 *   • Zero npm deps — pure platform API
 *   • No-op on browsers/devices without speechSynthesis (older Samsung,
 *     locked-down kiosks, missing voice packs)
 *   • Honors audioStore.isMuted — when the user mutes everything, the
 *     announcer goes silent too (the alternative is uncanny: muted music
 *     but a voice still narrating, which kills immersion)
 *   • Honors audioStore.announcerEnabled — separate persisted toggle
 *     surfaced via SlotAudioManager so users can keep music + sfx on
 *     and silence just the voice (some prefer pure ambient)
 *   • Honors prefers-reduced-motion — same gate, since the announcer
 *     is functionally an audio "motion" cue
 *   • Rate-limits section-change calls to 1 every 1.6s — fast scrolling
 *     the section tabs would otherwise produce a stutter of half-spoken
 *     names. The cancel + replace strategy means the *latest* section
 *     name always wins (skip the in-flight one), matching what the
 *     user is currently looking at.
 *   • Win/jackpot calls bypass the rate limit — those are punctuation
 *     beats and must fire on the exact moment they're emitted.
 *
 * Voice selection priority:
 *   en-GB / en-US natural voices ("Daniel", "Alex", "Google UK English
 *   Male", "Microsoft Guy"). Falls back to the platform default if no
 *   English voice is enumerated. The voiceschanged event re-runs voice
 *   selection so the host gets upgraded once Chrome's lazy voice list
 *   loads (typically ~200ms after first synth call on first page-load).
 *
 * Lifecycle:
 *   App.tsx → initSpeechAnnouncer()  AFTER user gesture (boot:tap)
 *   App.tsx → disposeSpeechAnnouncer() on unmount (HMR-safe, idempotent)
 */

import { bus } from './EventBus'
import { useAudioStore } from '../store'

// ─── Capability detection ────────────────────────────────────────────────────

/** True if the browser exposes window.speechSynthesis. */
export function isSpeechSynthSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
  )
}

// ─── Voice pick ──────────────────────────────────────────────────────────────

/**
 * Score a voice by how "casino host" it sounds. Higher = better.
 * We weight by lang prefix (en-GB cinematic > en-US > other en > non-en),
 * then by name match against known smooth-male engines.
 */
function scoreVoice(v: SpeechSynthesisVoice): number {
  let s = 0
  const name = v.name.toLowerCase()
  const lang = v.lang.toLowerCase()

  // Lang preference
  if (lang.startsWith('en-gb')) s += 100
  else if (lang.startsWith('en-us')) s += 80
  else if (lang.startsWith('en')) s += 60

  // Known cinematic male voices on macOS / iOS / Chrome / Edge
  if (name.includes('daniel')) s += 50          // macOS en-GB, classic
  if (name.includes('alex')) s += 45            // macOS en-US, very natural
  if (name.includes('arthur')) s += 40          // iOS 16+ en-GB
  if (name.includes('oliver')) s += 35          // iOS premium
  if (name.includes('guy')) s += 30             // Edge "Microsoft Guy"
  if (name.includes('male') && lang.startsWith('en')) s += 20
  if (name.includes('google uk english male')) s += 35
  if (name.includes('google us english')) s += 15

  // Penalize obvious low-quality voices that survive in some browsers
  if (name.includes('compact')) s -= 20
  if (name.includes('eloquence')) s -= 10

  // Local voices preferred over network voices for latency
  if (v.localService) s += 10

  return s
}

let _selectedVoice: SpeechSynthesisVoice | null = null

function pickVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  let best: SpeechSynthesisVoice | null = null
  let bestScore = -Infinity
  for (const v of voices) {
    const s = scoreVoice(v)
    if (s > bestScore) {
      bestScore = s
      best = v
    }
  }
  return best
}

// ─── Speak — gated, rate-limited, cancel-and-replace ─────────────────────────

interface SpeakOptions {
  /** Override voice rate (0.5 slow, 2.0 fast). Default 0.95 — slightly
   *  drawled-out for casino-host feel. */
  rate?: number
  /** Override pitch (0..2). Default 0.95 — barely lowered. */
  pitch?: number
  /** Override volume (0..1). Default 0.85 — undershoots music ambient. */
  volume?: number
  /** When true, ignore the rate-limiter (use for win/jackpot punctuation). */
  urgent?: boolean
}

let _lastSpeakAt = 0
const SPEAK_THROTTLE_MS = 1600

function shouldGate(): boolean {
  // Master mute → no voice. Single source of truth in audioStore.
  const audio = useAudioStore.getState()
  if (audio.isMuted) return true
  if (!audio.announcerEnabled) return true

  // prefers-reduced-motion users also silence the announcer — voice is
  // an "energetic stage" cue, contradicts the user's preference.
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return true
  }
  return false
}

/**
 * Speak a phrase. Public API — exposed for components that want to
 * trigger ad-hoc announcements (e.g. SlotAudioManager voice preview).
 * Returns true if the utterance was queued, false if gated.
 */
export function announce(text: string, opts: SpeakOptions = {}): boolean {
  if (!isSpeechSynthSupported()) return false
  if (shouldGate()) return false
  if (!text.trim()) return false

  const now = performance.now()
  if (!opts.urgent && now - _lastSpeakAt < SPEAK_THROTTLE_MS) return false
  _lastSpeakAt = now

  // Cancel any in-flight utterance so the new one wins. This is the
  // "latest section name always speaks" guarantee — without cancel the
  // queue piles up half-spoken names from rapid scrolling.
  try {
    window.speechSynthesis.cancel()
  } catch {
    // ignore — some browsers throw when cancelling an empty queue
  }

  const u = new SpeechSynthesisUtterance(text)
  u.rate = opts.rate ?? 0.95
  u.pitch = opts.pitch ?? 0.95
  u.volume = opts.volume ?? 0.85
  if (_selectedVoice) {
    u.voice = _selectedVoice
    u.lang = _selectedVoice.lang
  }

  try {
    window.speechSynthesis.speak(u)
  } catch (err) {
    console.info('[SpeechAnnouncer] speak failed:', err)
    return false
  }
  return true
}

// ─── EventBus wiring ─────────────────────────────────────────────────────────

const _cleanups: (() => void)[] = []
let _initialized = false

/**
 * Wire EventBus → speech. Idempotent — calling twice is a no-op.
 * MUST be called after the first user gesture (boot:tap is the canonical
 * unlock moment). Calling earlier may queue an utterance that the
 * browser silently drops; we accept that risk because the boot:complete
 * narration is the one we *want* to fire.
 */
export function initSpeechAnnouncer(): void {
  if (_initialized) return
  if (!isSpeechSynthSupported()) return
  _initialized = true

  // Voices may not be loaded yet on first call — Chromium loads them
  // lazily. Subscribe to the change event AND try synchronously now.
  const refreshVoice = () => {
    _selectedVoice = pickVoice()
  }
  refreshVoice()
  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = refreshVoice
  }

  // Boot complete → "Welcome. System online."
  // Fires once per session — subsequent boots are HMR-only.
  _cleanups.push(
    bus.on('boot:complete', () => {
      announce('Welcome. System online.', { urgent: true })
    }),
  )

  // Splash enter → "Starting portfolio."
  _cleanups.push(
    bus.on('splash:enter', () => {
      announce('Starting portfolio.', { urgent: true })
    }),
  )

  // Section change → "Now showing: SECTION_NAME"
  // The payload's `name` is already in display-case (e.g. "PROJECTS").
  // Lowercase it for the announcer so "PROJECTS" doesn't get spelled
  // out by some voice engines.
  _cleanups.push(
    bus.on('slot:section:change', (p) => {
      const pretty = p.name.toLowerCase()
      announce(`Now showing: ${pretty}.`)
    }),
  )

  // Item select → short ack so the user knows the click landed even
  // before the takeover animation starts. Throttled implicitly.
  _cleanups.push(
    bus.on('slot:item:select', () => {
      announce('Loading details.')
    }),
  )

  // Win callouts — urgent, escalating. Jackpot gets its own line.
  _cleanups.push(
    bus.on('slot:win', (p) => {
      let line = 'Win!'
      if (p.type === 'medium') line = 'Big win!'
      else if (p.type === 'big') line = 'Mega win!'
      else if (p.type === 'jackpot') line = 'Jackpot! Big winner!'
      announce(line, { urgent: true, rate: 1.05, pitch: 1.05 })
    }),
  )

  // Voice control "jackpot" cheat code → speak the phrase even if no
  // win event fires (it's a manual celebration trigger).
  _cleanups.push(
    bus.on('voice:command:jackpot', () => {
      announce('Jackpot! Big winner!', { urgent: true, rate: 1.05, pitch: 1.05 })
    }),
  )
}

/** Tear down all subscriptions, cancel any in-flight utterance. */
export function disposeSpeechAnnouncer(): void {
  if (!_initialized) return
  _initialized = false
  _cleanups.forEach((fn) => fn())
  _cleanups.length = 0
  if (isSpeechSynthSupported()) {
    try {
      window.speechSynthesis.cancel()
      // Detach voiceschanged so a subsequent re-init doesn't double-fire
      if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
    } catch {
      // ignore
    }
  }
  _selectedVoice = null
}

/** True if the announcer is currently wired and active. */
export function isAnnouncerActive(): boolean {
  return _initialized
}
