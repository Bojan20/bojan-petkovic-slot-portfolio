/**
 * Splash SFX — Web Audio API synthesized sound effects
 *
 * Zero files, zero loading. Casino-grade synthesized audio:
 * - cornerShimmer: metallic chime (corners fade in)
 * - labelWhoosh: filtered noise sweep (label slides in)
 * - nameReveal: deep cinematic boom + harmonic (name appears)
 * - lineSweep: metallic resonant sweep (line draws)
 * - buttonReady: warm tonal ding (button appears)
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/** Utility: create gain node with envelope */
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

/** Metallic shimmer — corners appearing */
export function cornerShimmer(): void {
  const ac = getCtx()
  const now = ac.currentTime

  // Two detuned high oscillators for shimmer
  for (const detune of [-15, 15]) {
    const osc = ac.createOscillator()
    const g = env(ac, 0.01, 0.05, 0.6, 0.08)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(3200, now)
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.6)
    osc.detune.value = detune
    osc.connect(g).connect(ac.destination)
    osc.start(now)
    osc.stop(now + 0.7)
  }

  // Soft noise burst
  const bufLen = ac.sampleRate * 0.3
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5
  const noise = ac.createBufferSource()
  noise.buffer = buf
  const hp = ac.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 6000
  const ng = env(ac, 0.005, 0.02, 0.25, 0.04)
  noise.connect(hp).connect(ng).connect(ac.destination)
  noise.start(now)
  noise.stop(now + 0.3)
}

/** Filtered noise sweep — label sliding in */
export function labelWhoosh(): void {
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

  const g = env(ac, 0.02, 0.1, 0.35, 0.12)
  noise.connect(bp).connect(g).connect(ac.destination)
  noise.start(now)
  noise.stop(now + 0.5)
}

/** Deep cinematic reveal — name appearing */
export function nameReveal(): void {
  const ac = getCtx()
  const now = ac.currentTime

  // Sub boom
  const sub = ac.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(80, now)
  sub.frequency.exponentialRampToValueAtTime(35, now + 0.8)
  const sg = env(ac, 0.01, 0.15, 0.7, 0.18)
  sub.connect(sg).connect(ac.destination)
  sub.start(now)
  sub.stop(now + 0.9)

  // Harmonic shimmer layer
  for (const freq of [440, 660, 880]) {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 1.0)
    const g = env(ac, 0.05, 0.1, 0.8, 0.06)
    osc.connect(g).connect(ac.destination)
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
  const ng = env(ac, 0.002, 0.03, 0.12, 0.15)
  noise.connect(lp).connect(ng).connect(ac.destination)
  noise.start(now)
  noise.stop(now + 0.2)
}

/** Metallic resonant sweep — line drawing */
export function lineSweep(): void {
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

  const g = env(ac, 0.01, 0.15, 0.35, 0.06)
  osc.connect(bp).connect(g).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.55)
}

/** Warm tonal ding — button ready */
export function buttonReady(): void {
  const ac = getCtx()
  const now = ac.currentTime

  // Primary bell tone
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 1047 // C6
  const g = env(ac, 0.003, 0.05, 0.8, 0.1)
  osc.connect(g).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.9)

  // Octave harmonic
  const osc2 = ac.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = 2094 // C7
  const g2 = env(ac, 0.003, 0.03, 0.5, 0.04)
  osc2.connect(g2).connect(ac.destination)
  osc2.start(now)
  osc2.stop(now + 0.55)

  // Fifth
  const osc3 = ac.createOscillator()
  osc3.type = 'sine'
  osc3.frequency.value = 1568 // G6
  const g3 = env(ac, 0.01, 0.04, 0.6, 0.05)
  osc3.connect(g3).connect(ac.destination)
  osc3.start(now)
  osc3.stop(now + 0.65)
}
