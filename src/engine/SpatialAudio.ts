/**
 * SpatialAudio — stereo positioning accents on top of the existing SFX
 *
 * Adds a thin layer of stereo-localized "ping" accents that fire ON TOP
 * of the normal centered SFX (synth library in SoundManager). The
 * existing synth pipeline is untouched — every call here mints its own
 * StereoPannerNode → masterGain so panning is true per-call, never
 * shared state.
 *
 * Why on top instead of replacing: the SoundManager synth library is
 * dense (25+ definitions, many connecting directly to _sfxGain). A
 * full spatial refactor would be invasive. Adding a parallel accent
 * gets 90% of the perceptual win (recruiters with headphones hear
 * reels distinctly tracked left→right) for ~80 lines of code.
 *
 * Pan mapping for a 5-reel slot:
 *   col 0 → -0.85   far left
 *   col 1 → -0.45   left of center
 *   col 2 →  0.00   center
 *   col 3 →  0.45   right of center
 *   col 4 →  0.85   far right
 *
 * (We cap at ±0.85 instead of ±1.0 — pure-channel pan feels too "in
 * the ear", -0.85 sounds clearly placed without the harsh isolation.)
 *
 * Public API:
 *   playReelAccent(col, totalCols) — short, bright stereo ping
 *   playPaylineTravel(durationMs)  — pan sweeps L→R over duration
 *   playJackpotBloom()             — wide center bloom with stereo halo
 *
 * All calls are no-ops until AudioContext is unlocked. Synthesis is
 * cheap (<0.1ms scheduling, GC-friendly — nodes are one-shot and let
 * the browser GC them when their schedule ends).
 */

import { getSfxGain } from './SoundManager'

/** Compute pan -1..1 for a reel column. */
export function getReelPan(col: number, totalCols: number): number {
  if (totalCols <= 1) return 0
  const t = col / (totalCols - 1)        // 0..1
  return (t - 0.5) * 2 * 0.85            // -0.85..+0.85
}

function getAc(): AudioContext | null {
  try {
    const out = getSfxGain()
    return out.context as AudioContext
  } catch {
    return null
  }
}

/**
 * Short bright stereo accent — meant to fire ALONGSIDE the normal
 * reel:land synth. Adds clear stereo localization (~120ms ping at the
 * column's pan position) without competing with the centered SFX.
 */
export function playReelAccent(col: number, totalCols: number, volume = 0.18): void {
  const ac = getAc()
  if (!ac || ac.state !== 'running') return

  const pan = getReelPan(col, totalCols)
  const now = ac.currentTime

  // Build chain: osc → gain → panner → sfxGain (already routed to master)
  const osc = ac.createOscillator()
  osc.type = 'triangle'
  // Pitch shifts down per column slightly so the L→R sweep also has a
  // tonal motion (left = brighter, right = darker). Gives the brain
  // two cues for "where" — pan AND pitch.
  const baseHz = 1400 - col * 80
  osc.frequency.setValueAtTime(baseHz, now)
  osc.frequency.exponentialRampToValueAtTime(baseHz * 0.55, now + 0.12)

  const g = ac.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(volume, now + 0.005)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.13)

  const panner = ac.createStereoPanner()
  panner.pan.value = pan

  osc.connect(g).connect(panner).connect(getSfxGain())
  osc.start(now)
  osc.stop(now + 0.14)
}

/**
 * Stereo travel — pan sweeps left-to-right over `durationMs`. Use on
 * payline animation reveals so the audience hears the win sweep across
 * the speakers as the visual sweeps across the screen.
 *
 * Sound: continuous filtered noise tail with cyan shimmer tone on top.
 */
export function playPaylineTravel(durationMs = 850, volume = 0.14): void {
  const ac = getAc()
  if (!ac || ac.state !== 'running') return

  const now = ac.currentTime
  const dur = durationMs / 1000

  // Filtered pink noise body — subtle whoosh
  const noise = ac.createBufferSource()
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate)
  const data = buf.getChannelData(0)
  // Cheap pink-ish noise via differentiator
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    last = (last + w * 0.02) * 0.96
    data[i] = last
  }
  noise.buffer = buf

  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(900, now)
  bp.frequency.exponentialRampToValueAtTime(2400, now + dur)
  bp.Q.value = 2.5

  const g = ac.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(volume, now + 0.08)
  g.gain.linearRampToValueAtTime(0, now + dur)

  const panner = ac.createStereoPanner()
  // Sweep -0.9 → +0.9 over the duration — creates the L→R travel feel
  panner.pan.setValueAtTime(-0.9, now)
  panner.pan.linearRampToValueAtTime(0.9, now + dur)

  noise.connect(bp).connect(g).connect(panner).connect(getSfxGain())
  noise.start(now)
  noise.stop(now + dur + 0.05)

  // Sparkle topper — sine that follows the pan
  const sp = ac.createOscillator()
  sp.type = 'sine'
  sp.frequency.setValueAtTime(2400, now)
  sp.frequency.linearRampToValueAtTime(1200, now + dur)
  const spg = ac.createGain()
  spg.gain.setValueAtTime(0, now)
  spg.gain.linearRampToValueAtTime(volume * 0.5, now + 0.05)
  spg.gain.linearRampToValueAtTime(0, now + dur)
  const spPan = ac.createStereoPanner()
  spPan.pan.setValueAtTime(-0.9, now)
  spPan.pan.linearRampToValueAtTime(0.9, now + dur)
  sp.connect(spg).connect(spPan).connect(getSfxGain())
  sp.start(now)
  sp.stop(now + dur + 0.05)
}

/**
 * Jackpot bloom — center hit with stereo halo (two slightly-detuned
 * sines at L=-0.6 and R=+0.6, plus a center body). Designed to layer
 * over the existing jackpot synth, adding spaciousness.
 */
export function playJackpotBloom(volume = 0.22): void {
  const ac = getAc()
  if (!ac || ac.state !== 'running') return

  const now = ac.currentTime
  const out = getSfxGain()

  // Center body — fundamental
  const body = ac.createOscillator()
  body.type = 'sine'
  body.frequency.setValueAtTime(440, now)
  body.frequency.exponentialRampToValueAtTime(880, now + 0.45)
  const bg = ac.createGain()
  bg.gain.setValueAtTime(0, now)
  bg.gain.linearRampToValueAtTime(volume, now + 0.04)
  bg.gain.exponentialRampToValueAtTime(0.001, now + 0.9)
  body.connect(bg).connect(out)
  body.start(now)
  body.stop(now + 0.95)

  // Stereo halo — two detuned octave-up sines, panned wide
  for (const [pan, detune] of [[-0.6, -7], [0.6, +7]] as const) {
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(880, now)
    o.frequency.exponentialRampToValueAtTime(1320, now + 0.55)
    o.detune.value = detune
    const g = ac.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(volume * 0.55, now + 0.06)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.95)
    const p = ac.createStereoPanner()
    p.pan.value = pan
    o.connect(g).connect(p).connect(out)
    o.start(now)
    o.stop(now + 1.0)
  }
}
