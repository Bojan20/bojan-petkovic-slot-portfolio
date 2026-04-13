/**
 * SoundManager — Event-driven audio za CORTEX Engine
 *
 * Sluša EventBus, pušta zvukove iz JSON konfiguracije.
 * Tri sloja: Web Audio API synth (splash SFX), Howler (file-based), Tone.js (procedural).
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

// ─── Synth SFX Library (Web Audio API — zero network) ────────────────────────

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

/** All synth SFX — keyed by ID from config */
const synthLibrary: Record<string, (volume: number) => void> = {
  sfx_shimmer: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime
    for (const detune of [-15, 15]) {
      const osc = ac.createOscillator()
      const g = env(ac, 0.01, 0.05, 0.6, 0.08 * vol)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(3200, now)
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.6)
      osc.detune.value = detune
      osc.connect(g).connect(_sfxGain!)
      osc.start(now)
      osc.stop(now + 0.7)
    }
    const bufLen = ac.sampleRate * 0.3
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5
    const noise = ac.createBufferSource()
    noise.buffer = buf
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 6000
    const ng = env(ac, 0.005, 0.02, 0.25, 0.04 * vol)
    noise.connect(hp).connect(ng).connect(_sfxGain!)
    noise.start(now)
    noise.stop(now + 0.3)
  },

  sfx_whoosh: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime
    const bufLen = ac.sampleRate * 0.5
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    const noise = ac.createBufferSource()
    noise.buffer = buf
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 2.5
    bp.frequency.setValueAtTime(200, now)
    bp.frequency.exponentialRampToValueAtTime(4000, now + 0.15)
    bp.frequency.exponentialRampToValueAtTime(800, now + 0.45)
    const g = env(ac, 0.02, 0.1, 0.35, 0.12 * vol)
    noise.connect(bp).connect(g).connect(_sfxGain!)
    noise.start(now)
    noise.stop(now + 0.5)
  },

  sfx_boom: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime
    // Sub boom
    const sub = ac.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(80, now)
    sub.frequency.exponentialRampToValueAtTime(35, now + 0.8)
    const sg = env(ac, 0.01, 0.15, 0.7, 0.18 * vol)
    sub.connect(sg).connect(_sfxGain!)
    sub.start(now)
    sub.stop(now + 0.9)
    // Harmonic shimmer
    for (const freq of [440, 660, 880]) {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 1.0)
      const g = env(ac, 0.05, 0.1, 0.8, 0.06 * vol)
      osc.connect(g).connect(_sfxGain!)
      osc.start(now)
      osc.stop(now + 1.0)
    }
    // Impact noise
    const bufLen = ac.sampleRate * 0.15
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.1))
    const noise = ac.createBufferSource()
    noise.buffer = buf
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2000
    const ng = env(ac, 0.002, 0.03, 0.12, 0.15 * vol)
    noise.connect(lp).connect(ng).connect(_sfxGain!)
    noise.start(now)
    noise.stop(now + 0.2)
  },

  sfx_sweep: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime
    const osc = ac.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.25)
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.5)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 8
    bp.frequency.setValueAtTime(600, now)
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.25)
    bp.frequency.exponentialRampToValueAtTime(1200, now + 0.5)
    const g = env(ac, 0.01, 0.15, 0.35, 0.06 * vol)
    osc.connect(bp).connect(g).connect(_sfxGain!)
    osc.start(now)
    osc.stop(now + 0.55)
  },

  sfx_ding: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime
    // C6
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1047
    const g = env(ac, 0.003, 0.05, 0.8, 0.1 * vol)
    osc.connect(g).connect(_sfxGain!)
    osc.start(now)
    osc.stop(now + 0.9)
    // C7
    const osc2 = ac.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = 2094
    const g2 = env(ac, 0.003, 0.03, 0.5, 0.04 * vol)
    osc2.connect(g2).connect(_sfxGain!)
    osc2.start(now)
    osc2.stop(now + 0.55)
    // G6
    const osc3 = ac.createOscillator()
    osc3.type = 'sine'
    osc3.frequency.value = 1568
    const g3 = env(ac, 0.01, 0.04, 0.6, 0.05 * vol)
    osc3.connect(g3).connect(_sfxGain!)
    osc3.start(now)
    osc3.stop(now + 0.65)
  },

  sfx_boot_hum: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime
    // Low frequency power-on hum
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(60, now)
    osc.frequency.linearRampToValueAtTime(120, now + 0.8)
    const g = env(ac, 0.1, 0.4, 0.5, 0.12 * vol)
    osc.connect(g).connect(_sfxGain!)
    osc.start(now)
    osc.stop(now + 1.1)
    // Digital chirp overlay
    const osc2 = ac.createOscillator()
    osc2.type = 'square'
    osc2.frequency.setValueAtTime(800, now + 0.2)
    osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.5)
    const g2 = env(ac, 0.01, 0.05, 0.2, 0.02 * vol)
    osc2.connect(g2).connect(_sfxGain!)
    osc2.start(now + 0.2)
    osc2.stop(now + 0.5)
  },

  sfx_boot_ready: (vol) => {
    if (!_unlocked) return
    const ac = getCtx()
    const now = ac.currentTime
    // Ascending chime — boot complete
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = env(ac, 0.005, 0.06, 0.3, 0.08 * vol)
      osc.connect(g).connect(_sfxGain!)
      osc.start(now + i * 0.1)
      osc.stop(now + i * 0.1 + 0.4)
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
