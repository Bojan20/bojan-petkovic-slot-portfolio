/**
 * AudioReactive — shared FFT analyser for visual reactivity
 *
 * Wraps any HTMLAudioElement (the ambient lounge track from App.tsx in
 * practice) into a Web Audio graph so visual layers can read live
 * frequency-band levels and pulse to the music.
 *
 * Design: zero React. The whole pipeline is a single shared singleton
 * because there is exactly one ambient music source. Visual consumers
 * (CyberNebula shader, CasinoField particles) read via the exported
 * `levelsRef` so there is no state plumbing or re-render churn — same
 * pattern we used for parallaxRef.
 *
 * Frequency bands (after smoothing):
 *   bass   ~20–250  Hz   → kick + bassline
 *   mid    ~250–2k  Hz   → vocals + body
 *   treble ~2k–20k  Hz   → cymbals + sparkle
 *
 * Why a separate AudioContext from SoundManager: SoundManager is the
 * SFX/synth pipeline. The ambient track lives on its own MediaElement
 * pipeline (volume controlled by the <audio>.volume property), and we
 * don't want analyser pickup polluted by sfx hits — we want it clean
 * on the music alone. A second AudioContext is cheap; browsers cap us
 * at ~6 contexts before warning, we use 2.
 *
 * Lifecycle:
 *   App.tsx → call attachAnalyser(audioElement) AFTER user gesture
 *             (boot:tap is the canonical unlock moment)
 *   Visual layers → import { levelsRef } and read each frame in their RAF
 *   App.tsx → call disposeAnalyser() on unmount (HMR-safe)
 *
 * If WebAudio is locked or unsupported, levelsRef stays at zeros — every
 * shader just renders the static neutral state. No errors thrown.
 */

export interface AudioLevels {
  /** Bass band amplitude, smoothed, 0..1 */
  bass: number
  /** Mid band amplitude, smoothed, 0..1 */
  mid: number
  /** Treble band amplitude, smoothed, 0..1 */
  treble: number
  /** Full-spectrum RMS, smoothed, 0..1 — useful for "is anything playing" */
  full: number
  /** Monotonic counter — increments each tick. Lets consumers detect a
   *  silent stream by checking if it changed since their last read. */
  tick: number
}

/** Live, mutable shared state. Visual layers read this every RAF. */
export const levelsRef: AudioLevels = {
  bass: 0,
  mid: 0,
  treble: 0,
  full: 0,
  tick: 0,
}

let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaElementAudioSourceNode | null = null
// Strict typing — TS5 splits Uint8Array<ArrayBuffer> from
// Uint8Array<SharedArrayBuffer>; getByteFrequencyData wants the former.
let freqBuf: Uint8Array<ArrayBuffer> | null = null
let rafId = 0
let attachedEl: HTMLAudioElement | null = null

// EMA smoothing factor — higher = snappier, lower = smoother. 0.35 reads
// well for both slow ambient pads and percussive transients.
const SMOOTH = 0.35

/**
 * Attach analyser to an audio element. Idempotent — calling twice with
 * the same element is a no-op. Calling with a different element disposes
 * the prior pipeline and rebuilds.
 *
 * MUST be called after a user gesture (browsers block AudioContext
 * creation otherwise — `boot:tap` is the canonical unlock moment).
 */
export function attachAnalyser(audioEl: HTMLAudioElement): void {
  if (attachedEl === audioEl && analyser) return
  if (attachedEl && attachedEl !== audioEl) disposeAnalyser()

  try {
    // Some browsers require crossOrigin to be set BEFORE the source is
    // first decoded. Our ambient track is same-origin so this is purely
    // defensive — but skip if already loaded to avoid CORS reloads.
    if (!audioEl.crossOrigin && audioEl.src.startsWith(window.location.origin)) {
      // Same-origin, no need
    }

    ctx = new AudioContext()
    source = ctx.createMediaElementSource(audioEl)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 256          // 128 frequency bins, plenty for 3-band EQ
    analyser.smoothingTimeConstant = 0.6  // built-in EMA at the FFT level

    source.connect(analyser)
    analyser.connect(ctx.destination)

    // Construct with explicit ArrayBuffer (not ArrayBufferLike) so TS
    // narrows correctly for getByteFrequencyData's strict signature.
    freqBuf = new Uint8Array(
      new ArrayBuffer(analyser.frequencyBinCount),
    ) as Uint8Array<ArrayBuffer>
    // Also fix avg() signature elsewhere: takes the same constrained type.
    attachedEl = audioEl

    // Resume if suspended (Safari needs explicit resume after user gesture)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    startPolling()
  } catch (err) {
    // MediaElementSource throws if the element is already wired to
    // another AudioContext — log + bail, visual layers stay at zeros.
    console.warn('[AudioReactive] analyser attach failed:', err)
    disposeAnalyser()
  }
}

function startPolling(): void {
  if (rafId) cancelAnimationFrame(rafId)

  const tick = () => {
    if (!analyser || !freqBuf) return
    analyser.getByteFrequencyData(freqBuf)

    // Frequency-bin → Hz mapping at 44.1kHz with fftSize=256:
    //   binHz = sampleRate / fftSize = 172.27 Hz per bin
    // 128 bins span 0..22050 Hz.
    //   bass band:   bins 0..1   → 0..345 Hz
    //   mid band:    bins 2..12  → 345..2240 Hz
    //   treble band: bins 13..63 → 2240..11000 Hz
    //   (we ignore the top half — mostly noise + browser rolloff)
    const bass = avg(freqBuf, 0, 2) / 255
    const mid = avg(freqBuf, 2, 13) / 255
    const treble = avg(freqBuf, 13, 64) / 255
    const full = avg(freqBuf, 0, 64) / 255

    // EMA smoothing on top of the analyser's built-in smoothing — gives
    // a noticeable extra polish for visuals (analyser smoothing affects
    // FFT bin values; ours affects the band averages).
    levelsRef.bass = lerp(levelsRef.bass, bass, SMOOTH)
    levelsRef.mid = lerp(levelsRef.mid, mid, SMOOTH)
    levelsRef.treble = lerp(levelsRef.treble, treble, SMOOTH)
    levelsRef.full = lerp(levelsRef.full, full, SMOOTH)
    levelsRef.tick++

    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function avg(buf: Uint8Array, lo: number, hi: number): number {
  let sum = 0
  const n = Math.min(hi, buf.length) - lo
  if (n <= 0) return 0
  for (let i = lo; i < lo + n; i++) sum += buf[i] ?? 0
  return sum / n
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Tear down the analyser pipeline. Safe to call multiple times.
 * Levels reset to zero so visual layers see "no audio" state.
 */
export function disposeAnalyser(): void {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  try {
    source?.disconnect()
    analyser?.disconnect()
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {})
    }
  } catch {
    // ignore disconnect errors during HMR or unmount races
  }
  ctx = null
  analyser = null
  source = null
  freqBuf = null
  attachedEl = null
  levelsRef.bass = 0
  levelsRef.mid = 0
  levelsRef.treble = 0
  levelsRef.full = 0
}

/** True if the analyser pipeline is wired and producing data. */
export function isAnalyserActive(): boolean {
  return analyser !== null
}
