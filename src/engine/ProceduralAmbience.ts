/**
 * ProceduralAmbience — V7.3 dynamic ambient drone bed.
 *
 * Sits ON TOP of the lounge.mp3 ambient track (which is already
 * piped through audioRef in App.tsx). This adds a slow, futuristic
 * synth drone layered through the existing musicGain bus, modulated
 * by spinPhase + sectionIdx + persona so the cabinet "breathes" with
 * the user instead of looping the same MP3 forever.
 *
 * Architecture:
 *   • Two oscillators detuned by ~7 cents → slight chorus shimmer
 *   • Lowpass filter modulated by an LFO → "machine breathing"
 *   • Reverb send via SoundManager's musicGain bus (free reverb)
 *   • Phase-driven gain envelope:
 *       idle    → 0.18 (calm pad)
 *       spinning → 0.34 (lifted, brighter)
 *       landing/winning → 0.44 (peak, brief)
 *       boot/splash → 0  (silent until slot phase)
 *   • Section-driven base frequency (root note offset):
 *       projects → A2 (110Hz)
 *       skills   → C3 (130.81Hz)
 *       about    → E2 (82.41Hz)
 *       career   → G2 (98Hz)
 *       contact  → D3 (146.83Hz)
 *
 * Honors prefers-reduced-motion (no LFO modulation, flat gain) and
 * audio-mute store (full silence). Idempotent + dispose-able.
 */

import { bus } from './EventBus'
import { useSlotStore } from '../store/slotStore'
import { useAudioStore } from '../store/audioStore'
import { getMusicGain, isAudioUnlocked } from './SoundManager'
import { SECTIONS } from '../data'

interface AmbienceState {
  ctx: AudioContext
  oscA: OscillatorNode
  oscB: OscillatorNode
  gain: GainNode
  filter: BiquadFilterNode
  lfo: OscillatorNode
  lfoGain: GainNode
  bodyPhaseObserver: MutationObserver | null
  unsubStore: (() => void) | null
  unsubMute: (() => void) | null
  reduced: boolean
}

let state: AmbienceState | null = null

const SECTION_ROOT_HZ: Record<string, number> = {
  projects: 110.00,    // A2
  skills:   130.81,    // C3
  about:    82.41,     // E2
  career:   98.00,     // G2
  contact:  146.83,    // D3
}

const PHASE_GAIN: Record<string, number> = {
  idle:     0.18,
  windup:   0.26,
  spinning: 0.34,
  landing:  0.44,
  snapping: 0.40,
  landed:   0.32,
}

function rampGain(g: GainNode, target: number, ctx: AudioContext, ms = 600): void {
  const now = ctx.currentTime
  const safe = Math.max(0.0001, target)
  g.gain.cancelScheduledValues(now)
  g.gain.setValueAtTime(g.gain.value, now)
  g.gain.linearRampToValueAtTime(safe, now + ms / 1000)
}

function rampFreq(o: OscillatorNode, target: number, ctx: AudioContext, ms = 900): void {
  const now = ctx.currentTime
  o.frequency.cancelScheduledValues(now)
  o.frequency.setValueAtTime(o.frequency.value, now)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, target), now + ms / 1000)
}

function applyBodyPhaseGain(s: AmbienceState): void {
  const phase = typeof document !== 'undefined'
    ? document.body.getAttribute('data-phase')
    : 'slot'
  // Below 'slot' phase: drone silent — we don't compete with boot/splash sfx
  if (phase !== 'slot') {
    rampGain(s.gain, 0, s.ctx, 800)
    return
  }
  const slotState = useSlotStore.getState()
  const muted = useAudioStore.getState().isMuted
  const phaseGain = PHASE_GAIN[slotState.spinPhase] ?? 0.18
  const target = muted ? 0 : phaseGain * 0.32  // overall scaled into musicBus
  rampGain(s.gain, target, s.ctx)
}

function applySection(s: AmbienceState): void {
  const slotState = useSlotStore.getState()
  const id = SECTIONS[slotState.currentSectionIdx]?.id ?? 'projects'
  const root = SECTION_ROOT_HZ[id] ?? 110
  rampFreq(s.oscA, root, s.ctx)
  // detune oscB ~7 cents → 0.405% sharper for chorus shimmer
  rampFreq(s.oscB, root * 1.00405, s.ctx)
}

/**
 * Initialize procedural ambience. Idempotent — repeated calls are
 * cheap. Must run AFTER unlockAudioContext() (boot:tap). Does
 * nothing if AudioContext unsupported (early-return).
 */
export function startProceduralAmbience(): void {
  if (state) return
  if (typeof window === 'undefined') return
  if (!isAudioUnlocked()) {
    // Defer: audio not yet unlocked; subscribe to boot:tap and try again
    const off = bus.on('boot:audio_unlocked', () => {
      off()
      startProceduralAmbience()
    })
    return
  }

  const dest = getMusicGain()  // route through the music bus (mutes with music slider)
  // The musicGain node is already attached to an AudioContext by
  // SoundManager — pull it back via .context so we don't need a
  // separate exported accessor.
  const ctx = dest.context as AudioContext

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  // Two slightly-detuned saw/triangle oscillators give the body
  const oscA = ctx.createOscillator()
  oscA.type = 'sawtooth'
  oscA.frequency.value = 110

  const oscB = ctx.createOscillator()
  oscB.type = 'triangle'
  oscB.frequency.value = 110 * 1.00405

  // Lowpass filter modulated by LFO — produces the "breathing" feel
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 360
  filter.Q.value = 4

  // LFO — slow sine that opens/closes the filter cutoff
  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = reduced ? 0 : 0.18  // 5.5s period (or static if reduced)
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = reduced ? 0 : 220  // ±220 Hz around base 360Hz cutoff

  // Master gain for the ambience layer; starts silent, ramps via phase
  const gain = ctx.createGain()
  gain.gain.value = 0

  // Wiring: oscA + oscB → filter → gain → musicGain
  oscA.connect(filter)
  oscB.connect(filter)
  filter.connect(gain)
  gain.connect(dest)

  // LFO modulates filter cutoff
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)

  oscA.start()
  oscB.start()
  if (!reduced) lfo.start()

  state = {
    ctx, oscA, oscB, gain, filter, lfo, lfoGain,
    bodyPhaseObserver: null,
    unsubStore: null,
    unsubMute: null,
    reduced,
  }

  // Watch body[data-phase] so we silence on boot/splash
  if (typeof document !== 'undefined') {
    const obs = new MutationObserver(() => applyBodyPhaseGain(state!))
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-phase'] })
    state.bodyPhaseObserver = obs
  }

  // Subscribe to slot store for phase + section changes
  state.unsubStore = useSlotStore.subscribe((s, prev) => {
    if (s.spinPhase !== prev.spinPhase) applyBodyPhaseGain(state!)
    if (s.currentSectionIdx !== prev.currentSectionIdx) applySection(state!)
  })

  // Subscribe to audio store for mute changes
  state.unsubMute = useAudioStore.subscribe((s, prev) => {
    if (s.isMuted !== prev.isMuted) applyBodyPhaseGain(state!)
  })

  // Initial paint
  applySection(state)
  applyBodyPhaseGain(state)
}

/** Tear down — releases oscillators, observers, store subscriptions. */
export function stopProceduralAmbience(): void {
  if (!state) return
  try {
    state.oscA.stop()
    state.oscB.stop()
    if (!state.reduced) state.lfo.stop()
  } catch { /* already stopped */ }
  try { state.oscA.disconnect() } catch { /* */ }
  try { state.oscB.disconnect() } catch { /* */ }
  try { state.lfo.disconnect() } catch { /* */ }
  try { state.lfoGain.disconnect() } catch { /* */ }
  try { state.filter.disconnect() } catch { /* */ }
  try { state.gain.disconnect() } catch { /* */ }
  state.bodyPhaseObserver?.disconnect()
  state.unsubStore?.()
  state.unsubMute?.()
  state = null
}

/** True iff the ambience layer is currently active (test helper). */
export function isProceduralAmbienceActive(): boolean {
  return state !== null
}
