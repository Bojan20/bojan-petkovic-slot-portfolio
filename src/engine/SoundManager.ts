/**
 * SoundManager — Event-driven audio za CORTEX Engine
 *
 * Sluša EventBus, pušta zvukove iz JSON konfiguracije.
 * Tri sloja: Web Audio API synth (splash SFX), Howler (file-based), Tone.js (procedural).
 *
 * Dizajn: "Blade Runner meets casino" — cyberpunk proceduralni sintovi,
 * FM synthesis, WaveShaper saturacija, feedback delay reverb simulacija.
 *
 * Nadmašuje IGT SoundManager:
 * - JSON-driven (promeni config, promeni zvuk)
 * - Spatial panning (reel 1 = levo, reel 5 = desno)
 * - Haptic feedback za mobile
 * - Tag-based volume buses (master/music/sfx)
 */

import { bus } from './EventBus'
import type { SoundEventConfig, SoundManagerConfig } from './config/configTypes'

// ─── AudioContext singleton ──────────────────────────────────────────────────

let _ctx: AudioContext | null = null
let _masterGain: GainNode | null = null
let _sfxGain: GainNode | null = null
let _musicGain: GainNode | null = null
let _reverbBus: GainNode | null = null
let _reverbReturn: GainNode | null = null
let _unlocked = false

function getCtx(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext()
    _masterGain = _ctx.createGain()
    _sfxGain = _ctx.createGain()
    _musicGain = _ctx.createGain()
    _sfxGain.connect(_masterGain)
    _musicGain.connect(_masterGain)
    _masterGain.connect(_ctx.destination)
    _masterGain.gain.value = 0.8
    _sfxGain.gain.value = 0.6
    _musicGain.gain.value = 0.7

    // ─── Feedback-delay "reverb" aux bus (cheap, CPU-friendly) ─────────────
    // Single shared network; synths send via _reverbBus, tail sums to _reverbReturn → sfx
    _reverbBus = _ctx.createGain()
    _reverbBus.gain.value = 0.0 // per-tap send amount controlled by synths
    _reverbReturn = _ctx.createGain()
    _reverbReturn.gain.value = 0.45

    const predelay = _ctx.createDelay(0.2)
    predelay.delayTime.value = 0.022

    const d1 = _ctx.createDelay(1.0)
    d1.delayTime.value = 0.087
    const d2 = _ctx.createDelay(1.0)
    d2.delayTime.value = 0.113
    const d3 = _ctx.createDelay(1.0)
    d3.delayTime.value = 0.151

    const fb1 = _ctx.createGain()
    fb1.gain.value = 0.42
    const fb2 = _ctx.createGain()
    fb2.gain.value = 0.38
    const fb3 = _ctx.createGain()
    fb3.gain.value = 0.34

    const tone = _ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 5200
    tone.Q.value = 0.7

    // Bus → predelay → parallel delays → cross feedback → tone → return
    _reverbBus.connect(predelay)
    predelay.connect(d1)
    predelay.connect(d2)
    predelay.connect(d3)
    d1.connect(fb1).connect(d2)
    d2.connect(fb2).connect(d3)
    d3.connect(fb3).connect(d1)
    d1.connect(tone)
    d2.connect(tone)
    d3.connect(tone)
    tone.connect(_reverbReturn)
    _reverbReturn.connect(_sfxGain)
  }
  return _ctx
}

export function getSfxGain(): GainNode {
  getCtx()
  return _sfxGain!
}

export function getMusicGain(): GainNode {
  getCtx()
  return _musicGain!
}

export function getMasterGain(): GainNode {
  getCtx()
  return _masterGain!
}

export function isAudioUnlocked(): boolean {
  return _unlocked
}

/**
 * Unlock AudioContext — MUST be called from user gesture handler.
 * After this, all synth SFX work without further interaction.
 */
export async function unlockAudioContext(): Promise<void> {
  if (_unlocked) return
  const ctx = getCtx()

  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  // Play silent buffer to fully unlock on iOS/Safari
  const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate)
  const src = ctx.createBufferSource()
  src.buffer = silentBuf
  src.connect(ctx.destination)
  src.start()

  _unlocked = true
  bus.emit('boot:audio_unlocked')
  console.log('[SoundManager] AudioContext unlocked ✓')
}

// ─── Synth helpers ───────────────────────────────────────────────────────────

/** ADSR-style envelope with exponential decay for "sjaj" */
function env(
  ac: AudioContext,
  attack: number,
  sustain: number,
  release: number,
  peak = 0.3,
): GainNode {
  const g = ac.createGain()
  const now = ac.currentTime
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(peak, now + attack)
  g.gain.setValueAtTime(peak, now + attack + sustain)
  g.gain.exponentialRampToValueAtTime(0.001, now + attack + sustain + release)
  return g
}

/** Pre-allocated shared noise buffer pool (avoid per-trigger alloc when possible) */
const _noiseCache = new Map<string, AudioBuffer>()
function getNoise(ac: AudioContext, durationSec: number, key: string): AudioBuffer {
  const cacheKey = `${key}_${durationSec.toFixed(3)}`
  const cached = _noiseCache.get(cacheKey)
  if (cached) return cached
  const len = Math.floor(ac.sampleRate * durationSec)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  _noiseCache.set(cacheKey, buf)
  return buf
}

/** Soft-saturation waveshaper curve (tanh-like). Backed by ArrayBuffer so the
 *  resulting Float32Array is assignable to WaveShaperNode.curve under TS 6 strict. */
let _satCurveCache: Float32Array<ArrayBuffer> | null = null
function getSatCurve(): Float32Array<ArrayBuffer> {
  if (_satCurveCache) return _satCurveCache
  const n = 4096
  const buf = new ArrayBuffer(n * 4)
  const curve = new Float32Array(buf)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 2.2) * 0.95
  }
  _satCurveCache = curve
  return curve
}

/** Send dry signal to reverb aux bus (if available) with send amount 0–1 */
function sendToReverb(src: AudioNode, amount: number): void {
  if (!_reverbBus || !_ctx) return
  const send = _ctx.createGain()
  send.gain.value = amount
  src.connect(send).connect(_reverbBus)
}

// ─── Synth SFX Library (Web Audio API — zero network) ────────────────────────
//
// All synths are PRE-TRIGGER allocated, post-decay GC'd by WebAudio engine.
// Every voice routes through _sfxGain; optional reverb send via sendToReverb().
// Keep names stable (sfx_shimmer etc.) — SlotAudioManager references these.

const synthLibrary: Record<string, (volume: number) => void> = {
  // ═══════════════════════════════════════════════════════════════════════
  // sfx_shimmer — "cyberdeck keyswitch" (splash corners)
  // 150Hz noise bandpass + 2kHz sine tick + metallic detuned shimmer tail
  // ═══════════════════════════════════════════════════════════════════════
  sfx_shimmer: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Layer A: broadband noise burst through 150Hz bandpass (mechanical thock)
    const noise = ac.createBufferSource()
    noise.buffer = getNoise(ac, 0.12, 'shimmer')
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 150
    bp.Q.value = 4
    const ng = env(ac, 0.001, 0.008, 0.08, 0.22 * vol)
    noise.connect(bp).connect(ng).connect(_sfxGain!)
    noise.start(now)
    noise.stop(now + 0.12)

    // Layer B: 2kHz sine tick — sharp digital click
    const tick = ac.createOscillator()
    tick.type = 'sine'
    tick.frequency.setValueAtTime(2400, now)
    tick.frequency.exponentialRampToValueAtTime(1800, now + 0.03)
    const tg = env(ac, 0.001, 0.004, 0.025, 0.14 * vol)
    tick.connect(tg).connect(_sfxGain!)
    tick.start(now)
    tick.stop(now + 0.035)

    // Layer C: metallic shimmer tail — 2 detuned sines, high reverb send
    for (const detune of [-14, 14]) {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(3200, now)
      osc.frequency.exponentialRampToValueAtTime(2100, now + 0.55)
      osc.detune.value = detune
      const g = env(ac, 0.01, 0.04, 0.55, 0.06 * vol)
      osc.connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.6)
      osc.start(now)
      osc.stop(now + 0.6)
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_whoosh — "warp drive ignition" (spin start / splash label)
  // Pitch sweep 100→600Hz + white-noise lowpass sweep 200→4kHz + reverb tail
  // ═══════════════════════════════════════════════════════════════════════
  sfx_whoosh: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Layer A: sawtooth pitch sweep (warp core)
    const osc = ac.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(100, now)
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.3)
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.5)

    const satShape = ac.createWaveShaper()
    satShape.curve = getSatCurve()
    satShape.oversample = '2x'

    const oscLp = ac.createBiquadFilter()
    oscLp.type = 'lowpass'
    oscLp.frequency.setValueAtTime(400, now)
    oscLp.frequency.exponentialRampToValueAtTime(2200, now + 0.3)
    oscLp.Q.value = 4

    const og = env(ac, 0.015, 0.08, 0.35, 0.14 * vol)
    osc.connect(satShape).connect(oscLp).connect(og).connect(_sfxGain!)
    sendToReverb(og, 0.35)
    osc.start(now)
    osc.stop(now + 0.55)

    // Layer B: filtered white noise sweep
    const noise = ac.createBufferSource()
    noise.buffer = getNoise(ac, 0.55, 'whoosh')
    const nlp = ac.createBiquadFilter()
    nlp.type = 'lowpass'
    nlp.frequency.setValueAtTime(200, now)
    nlp.frequency.exponentialRampToValueAtTime(4000, now + 0.3)
    nlp.frequency.exponentialRampToValueAtTime(1200, now + 0.55)
    nlp.Q.value = 1.2
    const ng = env(ac, 0.02, 0.1, 0.4, 0.1 * vol)
    noise.connect(nlp).connect(ng).connect(_sfxGain!)
    sendToReverb(ng, 0.4)
    noise.start(now)
    noise.stop(now + 0.55)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_boom — "plasma impact" (splash name / reel land big)
  // Layer A: pitched noise burst bandpass 800Hz Q=8 (80ms)
  // Layer B: sub-kick 120→60Hz (120ms)
  // Layer C: crystalline detuned tail 2400/2410Hz w/ reverb (300ms)
  // ═══════════════════════════════════════════════════════════════════════
  sfx_boom: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // A: pitched noise burst
    const noise = ac.createBufferSource()
    noise.buffer = getNoise(ac, 0.1, 'boom_a')
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 800
    bp.Q.value = 8
    const ng = env(ac, 0.002, 0.02, 0.08, 0.16 * vol)
    noise.connect(bp).connect(ng).connect(_sfxGain!)
    noise.start(now)
    noise.stop(now + 0.1)

    // B: sub-kick with pitch envelope
    const sub = ac.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(120, now)
    sub.frequency.exponentialRampToValueAtTime(60, now + 0.12)
    const satShape = ac.createWaveShaper()
    satShape.curve = getSatCurve()
    const sg = env(ac, 0.005, 0.02, 0.12, 0.32 * vol)
    sub.connect(satShape).connect(sg).connect(_sfxGain!)
    sub.start(now)
    sub.stop(now + 0.16)

    // C: crystalline tail — two detuned sines with heavy reverb
    for (const freq of [2400, 2410]) {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = env(ac, 0.01, 0.04, 0.3, 0.05 * vol)
      osc.connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.7)
      osc.start(now + 0.02)
      osc.stop(now + 0.38)
    }

    // Sub harmonic 5th for weight
    const h5 = ac.createOscillator()
    h5.type = 'sine'
    h5.frequency.setValueAtTime(180, now)
    h5.frequency.exponentialRampToValueAtTime(90, now + 0.18)
    const h5g = env(ac, 0.008, 0.03, 0.16, 0.1 * vol)
    h5.connect(h5g).connect(_sfxGain!)
    h5.start(now)
    h5.stop(now + 0.2)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_sweep — "chromatic burst" (splash line / hyperspace)
  // Resonant bandpass sweep + harmonic ghost, short and aggressive
  // ═══════════════════════════════════════════════════════════════════════
  sfx_sweep: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    const osc = ac.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.22)
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.48)

    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 10
    bp.frequency.setValueAtTime(600, now)
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.22)
    bp.frequency.exponentialRampToValueAtTime(1200, now + 0.48)

    const sat = ac.createWaveShaper()
    sat.curve = getSatCurve()

    const g = env(ac, 0.008, 0.12, 0.32, 0.08 * vol)
    osc.connect(bp).connect(sat).connect(g).connect(_sfxGain!)
    sendToReverb(g, 0.35)
    osc.start(now)
    osc.stop(now + 0.5)

    // Harmonic ghost — 3rd overtone, detuned
    const ghost = ac.createOscillator()
    ghost.type = 'sine'
    ghost.frequency.setValueAtTime(1800, now)
    ghost.frequency.exponentialRampToValueAtTime(3600, now + 0.22)
    ghost.detune.value = 8
    const gg = env(ac, 0.01, 0.05, 0.25, 0.03 * vol)
    ghost.connect(gg).connect(_sfxGain!)
    ghost.start(now + 0.01)
    ghost.stop(now + 0.3)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_ding — "digital ascension" (splash button / button ready)
  // FM bell-ish voice w/ operator ratio 2.01 for brilliance, stack of 3 notes
  // ═══════════════════════════════════════════════════════════════════════
  sfx_ding: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // FM bell: carrier + modulator with ratio 2.01 (inharmonic brilliance)
    const fmVoice = (carrierFreq: number, modRatio: number, modIndex: number, peak: number, decay: number, t0: number) => {
      const carrier = ac.createOscillator()
      const mod = ac.createOscillator()
      const modGain = ac.createGain()
      carrier.type = 'sine'
      mod.type = 'sine'
      carrier.frequency.value = carrierFreq
      mod.frequency.value = carrierFreq * modRatio
      modGain.gain.value = carrierFreq * modIndex

      mod.connect(modGain).connect(carrier.frequency)

      const g = env(ac, 0.003, 0.03, decay, peak * vol)
      carrier.connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.5)

      carrier.start(t0)
      mod.start(t0)
      carrier.stop(t0 + decay + 0.1)
      mod.stop(t0 + decay + 0.1)
    }

    // Stack: C6 main, G6 fifth, C7 octave — 2.01 inharmonic FM bell
    fmVoice(1047, 2.01, 0.55, 0.11, 0.75, now)
    fmVoice(1568, 2.01, 0.42, 0.05, 0.5, now + 0.004)
    fmVoice(2094, 2.01, 0.35, 0.035, 0.4, now + 0.008)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_boot_hum — cyberpunk power-on hum + digital chirp
  // Detuned sub-bass drones + resonant filter opens + digital squarewave chirp
  // ═══════════════════════════════════════════════════════════════════════
  sfx_boot_hum: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Layer A: dual detuned sub saws (power-on drone)
    for (const detune of [-12, 12]) {
      const osc = ac.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(55, now)
      osc.frequency.linearRampToValueAtTime(110, now + 0.8)
      osc.detune.value = detune

      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(200, now)
      lp.frequency.exponentialRampToValueAtTime(1400, now + 0.9)
      lp.Q.value = 6

      const sat = ac.createWaveShaper()
      sat.curve = getSatCurve()

      const g = env(ac, 0.08, 0.4, 0.5, 0.08 * vol)
      osc.connect(sat).connect(lp).connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.3)
      osc.start(now)
      osc.stop(now + 1.1)
    }

    // Layer B: digital chirp (square, rising)
    const chirp = ac.createOscillator()
    chirp.type = 'square'
    chirp.frequency.setValueAtTime(700, now + 0.2)
    chirp.frequency.exponentialRampToValueAtTime(2600, now + 0.5)
    const chirpG = env(ac, 0.01, 0.04, 0.2, 0.025 * vol)
    chirp.connect(chirpG).connect(_sfxGain!)
    sendToReverb(chirpG, 0.4)
    chirp.start(now + 0.2)
    chirp.stop(now + 0.55)

    // Layer C: transient click — sub-frame ignition pop
    const click = ac.createOscillator()
    click.type = 'sine'
    click.frequency.setValueAtTime(1200, now)
    click.frequency.exponentialRampToValueAtTime(400, now + 0.04)
    const clickG = env(ac, 0.001, 0.005, 0.04, 0.1 * vol)
    click.connect(clickG).connect(_sfxGain!)
    click.start(now)
    click.stop(now + 0.05)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_boot_ready — Phrygian Dominant arpeggio (futuristic ascension)
  // C, Db, E, F, G, Ab, Bb — scale degrees 1, b2, 3, 4, 5, b6, b7
  // ═══════════════════════════════════════════════════════════════════════
  sfx_boot_ready: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Phrygian Dominant: C, Db, E, G, Bb (I, b2, III, V, bVII)
    const notes = [523.25, 554.37, 659.25, 783.99, 932.33]
    notes.forEach((freq, i) => {
      const t0 = now + i * 0.09

      // FM operator w/ ratio 2.01
      const carrier = ac.createOscillator()
      const mod = ac.createOscillator()
      const modGain = ac.createGain()
      carrier.type = 'sine'
      mod.type = 'sine'
      carrier.frequency.value = freq
      mod.frequency.value = freq * 2.01
      modGain.gain.value = freq * 0.45
      mod.connect(modGain).connect(carrier.frequency)

      const g = env(ac, 0.004, 0.04, 0.38, 0.07 * vol)
      carrier.connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.55)

      carrier.start(t0)
      mod.start(t0)
      carrier.stop(t0 + 0.5)
      mod.stop(t0 + 0.5)
    })
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_rail_tick — "magnetic rail pulse" (reel tick)
  // FM carrier 220Hz, ratio 3, index 0.4 + sub-bass 60Hz impact
  // ═══════════════════════════════════════════════════════════════════════
  sfx_rail_tick: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // FM voice
    const carrier = ac.createOscillator()
    const mod = ac.createOscillator()
    const modGain = ac.createGain()
    carrier.type = 'sine'
    mod.type = 'sine'
    carrier.frequency.value = 220
    mod.frequency.value = 220 * 3
    modGain.gain.value = 220 * 0.4
    mod.connect(modGain).connect(carrier.frequency)

    const g = env(ac, 0.003, 0.012, 0.04, 0.14 * vol)
    carrier.connect(g).connect(_sfxGain!)
    carrier.start(now)
    mod.start(now)
    carrier.stop(now + 0.06)
    mod.stop(now + 0.06)

    // Sub-bass impact
    const sub = ac.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(80, now)
    sub.frequency.exponentialRampToValueAtTime(45, now + 0.025)
    const sg = env(ac, 0.002, 0.005, 0.02, 0.18 * vol)
    sub.connect(sg).connect(_sfxGain!)
    sub.start(now)
    sub.stop(now + 0.03)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_cyberdeck_click — tight UI click (alt naming for UI bindings)
  // 150Hz bandpass noise thock + 2kHz tick + short shimmer
  // ═══════════════════════════════════════════════════════════════════════
  sfx_cyberdeck_click: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    const noise = ac.createBufferSource()
    noise.buffer = getNoise(ac, 0.08, 'click')
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 150
    bp.Q.value = 5
    const ng = env(ac, 0.001, 0.005, 0.05, 0.2 * vol)
    noise.connect(bp).connect(ng).connect(_sfxGain!)
    noise.start(now)
    noise.stop(now + 0.08)

    const tick = ac.createOscillator()
    tick.type = 'sine'
    tick.frequency.value = 2000
    const tg = env(ac, 0.0005, 0.003, 0.025, 0.12 * vol)
    tick.connect(tg).connect(_sfxGain!)
    tick.start(now)
    tick.stop(now + 0.03)

    // Detuned shimmer overtone
    for (const detune of [-9, 9]) {
      const sh = ac.createOscillator()
      sh.type = 'sine'
      sh.frequency.value = 4200
      sh.detune.value = detune
      const shg = env(ac, 0.002, 0.008, 0.1, 0.02 * vol)
      sh.connect(shg).connect(_sfxGain!)
      sendToReverb(shg, 0.45)
      sh.start(now)
      sh.stop(now + 0.12)
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_warp_ignite — spin start alias (full warp drive, longer tail)
  // ═══════════════════════════════════════════════════════════════════════
  sfx_warp_ignite: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Sawtooth pitch sweep
    const osc = ac.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(100, now)
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.3)
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.6)

    const sat = ac.createWaveShaper()
    sat.curve = getSatCurve()
    sat.oversample = '2x'

    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(300, now)
    lp.frequency.exponentialRampToValueAtTime(2800, now + 0.3)
    lp.Q.value = 5

    const og = env(ac, 0.012, 0.12, 0.4, 0.16 * vol)
    osc.connect(sat).connect(lp).connect(og).connect(_sfxGain!)
    sendToReverb(og, 0.5)
    osc.start(now)
    osc.stop(now + 0.7)

    // Noise sweep
    const noise = ac.createBufferSource()
    noise.buffer = getNoise(ac, 0.7, 'warp')
    const nlp = ac.createBiquadFilter()
    nlp.type = 'lowpass'
    nlp.frequency.setValueAtTime(200, now)
    nlp.frequency.exponentialRampToValueAtTime(4000, now + 0.3)
    nlp.frequency.exponentialRampToValueAtTime(1400, now + 0.7)
    nlp.Q.value = 1.4
    const ng = env(ac, 0.02, 0.15, 0.45, 0.11 * vol)
    noise.connect(nlp).connect(ng).connect(_sfxGain!)
    sendToReverb(ng, 0.5)
    noise.start(now)
    noise.stop(now + 0.7)

    // Sub-bass boom at peak
    const sub = ac.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(60, now + 0.25)
    sub.frequency.exponentialRampToValueAtTime(40, now + 0.7)
    const sg = env(ac, 0.03, 0.1, 0.4, 0.15 * vol)
    sub.connect(sg).connect(_sfxGain!)
    sub.start(now + 0.25)
    sub.stop(now + 0.75)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_plasma_impact — reel land (explicit dual-layer plasma)
  // ═══════════════════════════════════════════════════════════════════════
  sfx_plasma_impact: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // A: pitched noise burst 800Hz Q=8
    const noise = ac.createBufferSource()
    noise.buffer = getNoise(ac, 0.08, 'plasma_a')
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 800
    bp.Q.value = 8
    const ng = env(ac, 0.002, 0.015, 0.065, 0.18 * vol)
    noise.connect(bp).connect(ng).connect(_sfxGain!)
    noise.start(now)
    noise.stop(now + 0.08)

    // B: sub-kick 120→60Hz
    const sub = ac.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(120, now)
    sub.frequency.exponentialRampToValueAtTime(60, now + 0.12)
    const sat = ac.createWaveShaper()
    sat.curve = getSatCurve()
    const sg = env(ac, 0.003, 0.02, 0.12, 0.28 * vol)
    sub.connect(sat).connect(sg).connect(_sfxGain!)
    sub.start(now)
    sub.stop(now + 0.15)

    // C: crystalline tail 2400/2410Hz w/ reverb
    for (const freq of [2400, 2410]) {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = env(ac, 0.008, 0.03, 0.3, 0.045 * vol)
      osc.connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.75)
      osc.start(now + 0.015)
      osc.stop(now + 0.36)
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_digital_ascension — win fanfare (Phrygian Dominant arp, FM voices)
  // 5 notes: C, Db, E, G, Bb → I, b2, III, V, bVII
  // ═══════════════════════════════════════════════════════════════════════
  sfx_digital_ascension: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    const notes = [523.25, 554.37, 659.25, 783.99, 932.33]

    notes.forEach((freq, i) => {
      const t0 = now + i * 0.12

      // FM voice w/ ratio 2.01 (brilliance)
      const carrier = ac.createOscillator()
      const mod = ac.createOscillator()
      const modGain = ac.createGain()
      carrier.type = 'sine'
      mod.type = 'sine'
      carrier.frequency.value = freq
      mod.frequency.value = freq * 2.01
      modGain.gain.value = freq * 0.5
      mod.connect(modGain).connect(carrier.frequency)

      const g = env(ac, 0.005, 0.08, 0.55, 0.08 * vol)
      carrier.connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.65)

      carrier.start(t0)
      mod.start(t0)
      carrier.stop(t0 + 0.7)
      mod.stop(t0 + 0.7)

      // Saturated sub layer — octave below
      const sub = ac.createOscillator()
      sub.type = 'sine'
      sub.frequency.value = freq * 0.25
      const sat = ac.createWaveShaper()
      sat.curve = getSatCurve()
      const sg = env(ac, 0.01, 0.1, 0.4, 0.05 * vol)
      sub.connect(sat).connect(sg).connect(_sfxGain!)
      sub.start(t0)
      sub.stop(t0 + 0.55)
    })

    // Final shimmer flourish — broad stereo-ish detuned pair
    const flourishT = now + notes.length * 0.12
    for (const detune of [-22, 22]) {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(2093, flourishT)
      osc.frequency.exponentialRampToValueAtTime(3136, flourishT + 0.4)
      osc.detune.value = detune
      const g = env(ac, 0.02, 0.1, 0.6, 0.05 * vol)
      osc.connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.8)
      osc.start(flourishT)
      osc.stop(flourishT + 0.75)
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_singularity — jackpot "collapse" (Cm7 stack, 16Hz AM stutter, rise)
  // ═══════════════════════════════════════════════════════════════════════
  sfx_singularity: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Cm7 stack: C, Eb, G, Bb (root 130.81) with micro-detune
    const roots = [130.81, 155.56, 196.0, 233.08]

    // 16Hz AM LFO shared
    const lfo = ac.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 16
    const lfoGain = ac.createGain()
    lfoGain.gain.value = 0.45
    lfo.connect(lfoGain)
    lfo.start(now)
    lfo.stop(now + 0.85)

    roots.forEach((base, i) => {
      for (const detune of [-8, 0, 8]) {
        const osc = ac.createOscillator()
        osc.type = 'sawtooth'
        // Pitch rise over 800ms (2 semitones up ≈ *1.122)
        osc.frequency.setValueAtTime(base, now)
        osc.frequency.exponentialRampToValueAtTime(base * 1.122, now + 0.8)
        osc.detune.value = detune + i * 2

        const sat = ac.createWaveShaper()
        sat.curve = getSatCurve()

        const lp = ac.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(800, now)
        lp.frequency.exponentialRampToValueAtTime(4000, now + 0.8)
        lp.Q.value = 3

        // AM gate: base gain + LFO stutter
        const amGate = ac.createGain()
        amGate.gain.value = 0.55
        lfoGain.connect(amGate.gain)

        const g = env(ac, 0.04, 0.55, 0.3, 0.045 * vol)
        osc.connect(sat).connect(lp).connect(amGate).connect(g).connect(_sfxGain!)
        sendToReverb(g, 0.6)

        osc.start(now)
        osc.stop(now + 0.9)
      }
    })

    // Final crash hit at collapse
    const hit = ac.createBufferSource()
    hit.buffer = getNoise(ac, 0.5, 'singularity_hit')
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2000
    const hitG = env(ac, 0.001, 0.04, 0.45, 0.14 * vol)
    hit.connect(hp).connect(hitG).connect(_sfxGain!)
    sendToReverb(hitG, 0.7)
    hit.start(now + 0.8)
    hit.stop(now + 1.3)

    // Sub-bass drop
    const subDrop = ac.createOscillator()
    subDrop.type = 'sine'
    subDrop.frequency.setValueAtTime(110, now + 0.78)
    subDrop.frequency.exponentialRampToValueAtTime(38, now + 1.2)
    const subG = env(ac, 0.01, 0.05, 0.4, 0.25 * vol)
    subDrop.connect(subG).connect(_sfxGain!)
    subDrop.start(now + 0.78)
    subDrop.stop(now + 1.3)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_chromatic_burst — hyperspace snap (short chromatic run, 200ms)
  // ═══════════════════════════════════════════════════════════════════════
  sfx_chromatic_burst: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // 4 chromatic ascending notes over 200ms (50ms each)
    const base = 880 // A5
    for (let i = 0; i < 4; i++) {
      const t0 = now + i * 0.05
      const freq = base * Math.pow(2, i / 12)

      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const sat = ac.createWaveShaper()
      sat.curve = getSatCurve()

      const g = env(ac, 0.002, 0.01, 0.04, 0.08 * vol)
      osc.connect(sat).connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.5)
      osc.start(t0)
      osc.stop(t0 + 0.06)
    }

    // Tail noise flick
    const noise = ac.createBufferSource()
    noise.buffer = getNoise(ac, 0.08, 'chromatic')
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 3000
    bp.Q.value = 6
    const ng = env(ac, 0.002, 0.005, 0.08, 0.06 * vol)
    noise.connect(bp).connect(ng).connect(_sfxGain!)
    noise.start(now + 0.18)
    noise.stop(now + 0.26)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // P4.5 — SECTION VOICES.
  // Five signature stings, one per top-level slot section. Plays on
  // tab change so the recruiter — eyes closed — knows where they are
  // by sound alone. ~600–900ms each, low gain, generous reverb.
  // Registered as synths so SlotAudioManager can audition them.
  // ═══════════════════════════════════════════════════════════════════════

  // ──── PROJECTS — warm pad swell (curtain rises) ───────────────────────
  // Sub-octave anchor + sustained sine pad with detuned shimmer.
  section_voice_projects: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Sub anchor: F2 (87.31 Hz)
    const sub = ac.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 87.31
    const subG = env(ac, 0.06, 0.45, 0.35, 0.10 * vol)
    sub.connect(subG).connect(_sfxGain!)
    sub.start(now)
    sub.stop(now + 0.95)

    // Sustained pad — F3 + Ab3 (minor third — warm, not too saccharine)
    for (const freq of [174.61, 207.65]) {
      for (const detune of [-6, 0, 6]) {
        const o = ac.createOscillator()
        o.type = 'sine'
        o.frequency.value = freq
        o.detune.value = detune
        const g = env(ac, 0.12, 0.35, 0.45, 0.045 * vol)
        o.connect(g).connect(_sfxGain!)
        sendToReverb(g, 0.55)
        o.start(now)
        o.stop(now + 0.95)
      }
    }
  },

  // ──── SKILLS — bright crystalline arpeggio (precision) ────────────────
  section_voice_skills: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Ascending arp: C5 E5 G5 B5 (major 7th — bright, technical)
    const notes = [523.25, 659.25, 783.99, 987.77]
    notes.forEach((freq, i) => {
      const t0 = now + i * 0.06

      for (const detune of [-4, 4]) {
        const osc = ac.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq
        osc.detune.value = detune
        const g = env(ac, 0.002, 0.015, 0.22, 0.05 * vol)
        osc.connect(g).connect(_sfxGain!)
        sendToReverb(g, 0.6)
        osc.start(t0)
        osc.stop(t0 + 0.26)
      }
    })
  },

  // ──── ABOUT — breathy filtered choir (intimate, human) ────────────────
  section_voice_about: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Filtered noise breath
    const noise = ac.createBufferSource()
    noise.buffer = getNoise(ac, 1.0, 'about_breath')
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1100
    bp.Q.value = 1.4
    const ng = env(ac, 0.08, 0.30, 0.55, 0.08 * vol)
    noise.connect(bp).connect(ng).connect(_sfxGain!)
    sendToReverb(ng, 0.8)
    noise.start(now)
    noise.stop(now + 1.0)

    // Low pad — A2 + E3 (open fifth, choir-like)
    for (const freq of [110.0, 164.81]) {
      const o = ac.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq
      const g = env(ac, 0.18, 0.25, 0.50, 0.06 * vol)
      o.connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.65)
      o.start(now)
      o.stop(now + 0.95)
    }
  },

  // ──── CAREER — brass swell with formant sweep (authority) ─────────────
  section_voice_career: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Saw foundation — D3 + A3 (open fifth, fanfare-like)
    for (const freq of [146.83, 220.0]) {
      const osc = ac.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq

      const sat = ac.createWaveShaper()
      sat.curve = getSatCurve()
      sat.oversample = '2x'

      // Formant filter sweep — emulates brass attack
      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(420, now)
      lp.frequency.exponentialRampToValueAtTime(2400, now + 0.35)
      lp.frequency.exponentialRampToValueAtTime(900, now + 0.85)
      lp.Q.value = 4

      const g = env(ac, 0.04, 0.30, 0.45, 0.045 * vol)
      osc.connect(sat).connect(lp).connect(g).connect(_sfxGain!)
      sendToReverb(g, 0.5)
      osc.start(now)
      osc.stop(now + 0.85)
    }
  },

  // ──── CONTACT — bell ping (call to action) ────────────────────────────
  section_voice_contact: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Two-stroke bell: G5 + D6 (perfect fifth)
    const strikes = [
      { freq: 783.99, t: 0,    peak: 0.10 * vol },
      { freq: 1174.66, t: 0.12, peak: 0.07 * vol },
    ]
    for (const s of strikes) {
      const t0 = now + s.t
      // Bell = fundamental + inharmonic partials
      const partials = [1.0, 2.76, 5.4, 8.93]
      partials.forEach((mult, i) => {
        const osc = ac.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = s.freq * mult
        const g = env(ac, 0.001, 0.015, 0.50 / (i + 1), s.peak / (i + 1))
        osc.connect(g).connect(_sfxGain!)
        sendToReverb(g, 0.75)
        osc.start(t0)
        osc.stop(t0 + 0.65)
      })
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // sfx_crystal_arp — crystalline arpeggio (used in cyberBoot sequence)
  // ═══════════════════════════════════════════════════════════════════════
  sfx_crystal_arp: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime

    // Ascending arp: C5 G5 C6 E6 G6
    const notes = [523.25, 783.99, 1046.5, 1318.51, 1568.0]
    notes.forEach((freq, i) => {
      const t0 = now + i * 0.08

      for (const detune of [-6, 6]) {
        const osc = ac.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.detune.value = detune
        const g = env(ac, 0.003, 0.02, 0.28, 0.05 * vol)
        osc.connect(g).connect(_sfxGain!)
        sendToReverb(g, 0.7)
        osc.start(t0)
        osc.stop(t0 + 0.32)
      }
    })
  },
}

// ─── Sound Manager ───────────────────────────────────────────────────────────

let _config: SoundManagerConfig | null = null
const _cleanups: (() => void)[] = []

/** Initialize SoundManager with config and wire up EventBus listeners */
export function initSoundManager(config: SoundManagerConfig): void {
  // Dispose previous listeners
  disposeSoundManager()

  _config = config

  // Ensure context + aux bus exist
  getCtx()

  // Set volumes from config
  if (_masterGain) _masterGain.gain.value = config.volumes.master
  if (_sfxGain) _sfxGain.gain.value = config.volumes.sfx
  if (_musicGain) _musicGain.gain.value = config.volumes.music

  // Wire up all event → sound mappings
  for (const [eventName, eventConfig] of Object.entries(config.events)) {
    const unsub = bus.on(eventName as keyof typeof bus extends never ? never : never, (() => {
      playSoundEvent(eventConfig)
    }) as () => void)
    _cleanups.push(unsub)
  }

  console.log(`[SoundManager] Initialized with ${Object.keys(config.events).length} event mappings`)
}

/** Play a sound from event config */
function playSoundEvent(config: SoundEventConfig): void {
  if (!_unlocked) return

  const { audio, haptic } = config

  if (audio) {
    const synth = synthLibrary[audio.play]
    if (synth) {
      synth(audio.volume ?? 1.0)
    } else {
      console.warn(`[SoundManager] Unknown sound: "${audio.play}"`)
    }
  }

  if (haptic && navigator.vibrate) {
    const patterns: Record<string, number[]> = {
      light: [15],
      medium: [40],
      heavy: [80],
      reel_stop: [50],
      big_win: [100, 50, 200, 50, 100],
      button: [20],
      jackpot: [60, 30, 60, 30, 180, 60, 240],
    }
    const pattern = typeof haptic === 'string' ? patterns[haptic] : haptic
    if (pattern) navigator.vibrate(pattern)
  }
}

/** Play a sound by ID directly (bypass EventBus) */
export function playSynthById(id: string, volume = 1.0): void {
  const synth = synthLibrary[id]
  if (synth) synth(volume)
}

/** List all available synth IDs (for debug panel / SlotAudioManager) */
export function listSynthIds(): string[] {
  return Object.keys(synthLibrary)
}

/** Set volume for a bus */
export function setVolume(bus_name: 'master' | 'sfx' | 'music', vol: number): void {
  const clamped = Math.max(0, Math.min(1, vol))
  if (bus_name === 'master' && _masterGain) _masterGain.gain.value = clamped
  if (bus_name === 'sfx' && _sfxGain) _sfxGain.gain.value = clamped
  if (bus_name === 'music' && _musicGain) _musicGain.gain.value = clamped
}

/** Cleanup all listeners */
export function disposeSoundManager(): void {
  _cleanups.forEach((fn) => fn())
  _cleanups.length = 0
  _config = null
}

/** Get current config (for debug panel) */
export function getSoundConfig(): SoundManagerConfig | null {
  return _config
}
