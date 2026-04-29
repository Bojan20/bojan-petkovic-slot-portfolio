/**
 * VoiceControl — Web Speech API command recognizer
 *
 * Hands-free portfolio navigation. The recruiter says "spin", the reels
 * spin. Says "next", section advances. Says "mute", audio cuts. Toggle
 * on/off via the floating mic indicator (or `initVoiceControl()`).
 *
 * Why hand-rolled instead of a library:
 *   • Web Speech API is browser-native — zero npm deps, ~1.5kB of code
 *   • We own the command vocabulary and dispatch — no abstractions
 *   • Continuous-mode recognition with auto-restart on `onend` so the
 *     listener never silently dies (Chromium drops the session every
 *     ~60s of silence — we restart transparently)
 *
 * Browser support:
 *   • Chrome / Edge / Samsung Internet / Opera — works (webkitSpeechRecognition)
 *   • Safari — works on macOS (SpeechRecognition prefixed) since v14.1
 *   • Firefox — NOT supported (no implementation as of 2026)
 *   • Mobile Chrome / Samsung Internet — works, requires HTTPS or localhost
 *
 * Privacy: nothing is stored or transmitted by us — the recognition is
 * either local (Chromium-based desktop) or routed via the browser's
 * own service. We just consume the transcript string.
 *
 * The vocabulary (commands → bus events):
 *   "spin" / "go" / "play"           → voice:command:spin
 *   "next" / "forward"               → voice:command:next
 *   "back" / "previous"              → voice:command:back
 *   "mute" / "audio off" / "silence" → voice:command:mute
 *   "unmute" / "audio on"            → voice:command:unmute
 *   "jackpot" / "win"                → voice:command:jackpot   (easter egg)
 *
 * Matching is case-insensitive substring on the final transcript chunk —
 * "go ahead and spin it" still triggers spin. Single-utterance debounce
 * prevents double-firing within 600ms.
 */

import { bus } from './EventBus'

// ── Browser API typings (vendor-prefixed) ────────────────────────────
// SpeechRecognition is not in lib.dom for Safari/Chromium prefix paths,
// so we declare the minimal shape we use.
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(idx: number): SpeechRecognitionResult
  [idx: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(idx: number): SpeechRecognitionAlternative
  [idx: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: Event) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

// ── Internal state ──────────────────────────────────────────────────
let recognizer: SpeechRecognitionInstance | null = null
let listening = false
let intentionalStop = false
let lastCommandAt = 0
let lastCommand = ''

// Listener registry for UI components (mic indicator dot, etc.)
type StatusListener = (status: VoiceStatus) => void
const statusListeners = new Set<StatusListener>()

export interface VoiceStatus {
  listening: boolean
  supported: boolean
  lastCommand: string | null
  lastCommandAt: number
}

// ── Vocabulary → command name ───────────────────────────────────────
// Order matters: longer phrases checked first so "audio off" wins over
// just "off". Regex word-boundary matched (case-insensitive).
const VOCABULARY: Array<{ patterns: string[]; cmd: VoiceCommand }> = [
  { patterns: ['audio off', 'sound off', 'silence', 'mute'], cmd: 'mute' },
  { patterns: ['audio on', 'sound on', 'unmute'], cmd: 'unmute' },
  { patterns: ['previous', 'back', 'go back'], cmd: 'back' },
  { patterns: ['next', 'forward', 'go next'], cmd: 'next' },
  { patterns: ['jackpot', 'win', 'big win'], cmd: 'jackpot' },
  // Session capture commands (Phase 32) — voice control parity with
  // the keybindings (Ctrl+Shift+S/L/R) and DevOverlay buttons.
  { patterns: ['save snapshot', 'save session', 'export'], cmd: 'save' },
  { patterns: ['load snapshot', 'restore session', 'import'], cmd: 'load' },
  { patterns: ['record reel', 'start recording', 'stop recording', 'record'], cmd: 'record' },
  { patterns: ['spin', 'go', 'play', 'roll'], cmd: 'spin' },
]

export type VoiceCommand =
  | 'spin' | 'next' | 'back' | 'mute' | 'unmute' | 'jackpot'
  | 'save' | 'load' | 'record'

const DEBOUNCE_MS = 600

// ── Public API ──────────────────────────────────────────────────────

/** True if the browser supports speech recognition. */
export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/** True if the recognizer is currently listening. */
export function isVoiceListening(): boolean {
  return listening
}

/**
 * Subscribe to voice status changes (listening on/off, last command).
 * Used by <VoiceIndicator> to drive the floating mic dot UI.
 * Returns an unsubscribe function.
 */
export function onVoiceStatus(fn: StatusListener): () => void {
  statusListeners.add(fn)
  // Fire once with current state so subscribers don't see undefined first
  fn(getStatus())
  return () => statusListeners.delete(fn)
}

function getStatus(): VoiceStatus {
  return {
    listening,
    supported: isVoiceSupported(),
    lastCommand: lastCommand || null,
    lastCommandAt,
  }
}

function broadcastStatus(): void {
  const s = getStatus()
  statusListeners.forEach((fn) => {
    try { fn(s) } catch { /* swallow consumer errors */ }
  })
}

/**
 * Start listening. Idempotent — calling twice is a no-op.
 * Browsers prompt for mic permission on first call (user MUST consent).
 */
export function startVoiceControl(): boolean {
  if (listening) return true
  if (!isVoiceSupported()) {
    console.info('[VoiceControl] SpeechRecognition not supported in this browser')
    return false
  }

  const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition)!
  recognizer = new Ctor()
  recognizer.continuous = true
  recognizer.interimResults = false       // only fire on finalized utterances
  recognizer.lang = 'en-US'                // English commands; sr-Latn not widely supported
  recognizer.maxAlternatives = 1
  intentionalStop = false

  recognizer.onresult = (e) => {
    // Walk new results from resultIndex onward, only act on finalized ones
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]
      if (!result || !result.isFinal) continue
      const alt = result[0]
      if (!alt) continue
      const transcript = alt.transcript.toLowerCase().trim()
      if (!transcript) continue
      handleTranscript(transcript)
    }
  }

  recognizer.onerror = (e) => {
    // Common errors:
    //  • not-allowed → user denied mic permission
    //  • no-speech   → silence timeout (Chromium ~60s)
    //  • network     → connection issue, recognition service unreachable
    //  • aborted     → we called abort()
    // For most we let onend handle the restart; for not-allowed we stop.
    const err = (e as unknown as { error?: string }).error
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      console.warn('[VoiceControl] mic permission denied — disabling')
      intentionalStop = true
      stopVoiceControl()
    }
  }

  recognizer.onend = () => {
    // Chromium drops continuous sessions after ~60s of silence.
    // Auto-restart unless the user explicitly stopped us.
    if (!intentionalStop && listening) {
      try { recognizer?.start() } catch { /* race: already started */ }
    }
  }

  recognizer.onstart = () => {
    listening = true
    broadcastStatus()
  }

  try {
    recognizer.start()
    return true
  } catch (err) {
    console.warn('[VoiceControl] start failed:', err)
    return false
  }
}

/** Stop listening + tear down. Safe to call multiple times. */
export function stopVoiceControl(): void {
  intentionalStop = true
  listening = false
  try { recognizer?.abort() } catch { /* noop */ }
  recognizer = null
  broadcastStatus()
}

/** Toggle listening on/off. Returns the new state. */
export function toggleVoiceControl(): boolean {
  if (listening) {
    stopVoiceControl()
    return false
  }
  return startVoiceControl()
}

// ── Internal: transcript → command dispatch ─────────────────────────
function handleTranscript(transcript: string): void {
  const cmd = matchCommand(transcript)
  if (!cmd) return

  const now = performance.now()
  // Debounce: don't fire the same command twice within DEBOUNCE_MS.
  // Different commands within the window are still allowed (e.g. someone
  // says "spin then next" — both should fire).
  if (cmd === lastCommand && now - lastCommandAt < DEBOUNCE_MS) return

  lastCommand = cmd
  lastCommandAt = now

  // Dispatch via EventBus so subscribers (SlotMachine, audio store) can
  // react. Keeps the recognizer decoupled from app surface.
  bus.emit(`voice:command:${cmd}` as 'voice:command:spin')
  broadcastStatus()
}

function matchCommand(transcript: string): VoiceCommand | null {
  for (const entry of VOCABULARY) {
    for (const pat of entry.patterns) {
      // Word-boundary check — "spinach" must NOT match "spin"
      const re = new RegExp(`\\b${pat.replace(/\s+/g, '\\s+')}\\b`, 'i')
      if (re.test(transcript)) return entry.cmd
    }
  }
  return null
}
