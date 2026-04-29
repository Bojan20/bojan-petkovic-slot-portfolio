/**
 * BootScreen — Neural Sync Boot Sequence (Cyberpunk)
 *
 * - Data stream background (hex/binary curtain)
 * - 6 loading steps with typewriter reveal (~30 ms/char)
 * - Holographic ring pulse around the CTA
 * - System-online burst: scanline flash + static noise overlay
 * - Tap / Space / Enter → AudioContext unlock + boot:complete
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  bus,
  unlockAudioContext,
  initSoundManager,
  playSynthById,
  portfolioConfig,
  setStickCursorWriter,
  setMidiCursorWriter,
} from '../engine'
import { CyberNebula } from './boot/CyberNebula'
import { QuantumField } from './boot/QuantumField'
import { CasinoField, type ParallaxState } from './boot/CasinoField'
import { BootTagline } from './boot/BootTagline'
import styles from './BootScreen.module.css'

/** Fire a vibration pattern if the device + user-agent supports it.
 *  No-op silently otherwise (Safari, desktop, denied permission). */
function haptic(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return
  try {
    const nav = navigator as Navigator & {
      vibrate?: (p: number | number[]) => boolean
    }
    nav.vibrate?.(pattern)
  } catch { /* unavailable */ }
}

/** Stable IGT-style serial — varies per session but deterministic per page-load */
function generateSerial(): string {
  const seg = (n: number) => Math.floor(Math.random() * Math.pow(36, n))
    .toString(36).toUpperCase().padStart(n, '0')
  return `SN-${seg(4)}-${seg(3)}`
}

/** Detect once: does the user prefer reduced motion (vestibular safety) */
function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Mobile detection — drives the visibility of the finger-tap cue */
function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'ontouchstart' in window ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  )
}

interface BootScreenProps {
  onComplete: () => void
}

/* ── Data stream columns ─ seeded randomness keeps SSR/CSR parity ── */
const HEX_CHARS = '0123456789ABCDEF∑Ω∆Φ∏√∞≈'
const STREAM_COLS = 38
const STREAM_ROWS = 56

function seeded(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

function buildStreamText(col: number): string {
  let out = ''
  for (let r = 0; r < STREAM_ROWS; r++) {
    const idx = Math.floor(seeded(col * 101 + r * 7) * HEX_CHARS.length)
    out += HEX_CHARS[idx]
    if (r % 3 === 2) out += ' '
    out += '\n'
  }
  return out
}

export function BootScreen({ onComplete }: BootScreenProps) {
  const [progress, setProgress] = useState(0)
  const [loadingDone, setLoadingDone] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [burst, setBurst] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [typed, setTyped] = useState('')
  const tappedRef = useRef(false)
  const startTimeRef = useRef(0)
  const bootDivRef = useRef<HTMLDivElement>(null)
  // CRITICAL: parallax CSS vars (--mx, --my) are written here, NOT on .boot.
  // The vars are consumed only by .sevenStage (BootScreen.module.css:182-187),
  // and writing them to .boot invalidated style for every descendant that
  // shares the root compositor layer → mobile flicker on everything except
  // the seven (which is the only element with its own GPU layer via
  // will-change + 3D transform). Hoisting the writes onto sevenStage scopes
  // the invalidation to the already-promoted layer.
  const sevenStageRef = useRef<HTMLDivElement>(null)
  const hudBarFillRef = useRef<HTMLDivElement>(null)
  // Shared parallax state — written by our RAF, read directly by canvas
  // children (CyberNebula, CasinoField). Sharing via ref instead of CSS
  // vars + getComputedStyle avoids forcing style recalc on every frame,
  // which was the dominant cause of mobile flicker pre-2026-04.
  const mouseLerpRef = useRef<ParallaxState>({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 })
  const parallaxRafRef = useRef(0)
  const reducedMotion = useMemo(() => getPrefersReducedMotion(), [])
  const mobile = useMemo(() => isMobile(), [])
  const serial = useMemo(() => generateSerial(), [])
  // Gyroscope calibration baseline — captured on first reading so resting
  // phone pose maps to (0.5, 0.5). Avoids the "7 lurches sideways" feel
  // recruiters get when they pick up the phone in landscape.
  const gyroBaselineRef = useRef<{ beta: number; gamma: number } | null>(null)
  const lastInputAtRef = useRef(performance.now())
  const inputModeRef = useRef<'idle' | 'mouse' | 'touch' | 'gyro'>('idle')

  const { boot, audio } = portfolioConfig
  const loadingSteps: string[] = boot.loadingSteps ?? []

  // Pre-compute data stream columns once
  // Some columns flagged as "bright" (Matrix cursor), some as "glitch"
  const streamColumns = useMemo(
    () => Array.from({ length: STREAM_COLS }, (_, i) => ({
      text: buildStreamText(i),
      delay: `${seeded(i * 13) * 5}s`,
      duration: `${2.8 + seeded(i * 17) * 3.8}s`,
      left: `${(i / STREAM_COLS) * 100}%`,
      bright: i % 9 === 0 || i % 13 === 0,       // ~2-3 bright "cursor" cols
      glitch: i % 7 === 3,                         // ~5 glitch cols
      glitchDelay: `${seeded(i * 29) * 8}s`,
    })),
    [],
  )

  // 3D parallax — mobile-first, multi-input (gyro > touch > mouse > ambient breath)
  // All inputs converge on a normalized (tx, ty) ∈ [0,1] target, lerped to (x, y)
  // and written to CSS vars `--mx` / `--my`. Zero React re-renders.
  useEffect(() => {
    const m = mouseLerpRef.current
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

    // ── Mouse (desktop) ────────────────────────────────────────────────
    const handleMouse = (e: MouseEvent) => {
      m.tx = e.clientX / window.innerWidth
      m.ty = e.clientY / window.innerHeight
      lastInputAtRef.current = performance.now()
      inputModeRef.current = 'mouse'
    }

    // ── Touch (mobile drag — finger steers Lucky 7) ────────────────────
    const handleTouch = (e: TouchEvent) => {
      const t = e.touches[0] || e.changedTouches[0]
      if (!t) return
      m.tx = clamp01(t.clientX / window.innerWidth)
      m.ty = clamp01(t.clientY / window.innerHeight)
      lastInputAtRef.current = performance.now()
      inputModeRef.current = 'touch'
    }

    // ── Gyroscope (mobile tilt — phone IS the joystick) ────────────────
    // beta  = front/back tilt  ([-180, 180], ~0 when phone flat)
    // gamma = left/right tilt  ([-90, 90])
    // We grab the first reading as the baseline (resting pose) so any
    // device orientation feels neutral, then map ±25° → full range.
    const TILT_RANGE_DEG = 25
    const handleOrient = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0
      const gamma = e.gamma ?? 0
      if (!gyroBaselineRef.current) {
        gyroBaselineRef.current = { beta, gamma }
      }
      const baseline = gyroBaselineRef.current
      const dBeta = beta - baseline.beta   // forward/back delta
      const dGamma = gamma - baseline.gamma // left/right delta
      m.tx = clamp01(0.5 + dGamma / (TILT_RANGE_DEG * 2))
      m.ty = clamp01(0.5 + dBeta / (TILT_RANGE_DEG * 2))
      lastInputAtRef.current = performance.now()
      inputModeRef.current = 'gyro'
    }

    // ── RAF tick: lerp + idle ambient breathing ────────────────────────
    const tick = () => {
      const now = performance.now()
      const idleFor = now - lastInputAtRef.current

      // After 1.5s of no input, gently breathe with sin/cos so the 7
      // never goes still — matters on mobile where the user's not
      // hovering a mouse. Skipped entirely under prefers-reduced-motion
      // so vestibular-sensitive users get a static frame.
      if (!reducedMotion && idleFor > 1500) {
        const t = now * 0.0006
        const ambX = 0.5 + Math.sin(t) * 0.10
        const ambY = 0.5 + Math.cos(t * 0.85) * 0.08
        m.tx = lerp(m.tx, ambX, 0.04)
        m.ty = lerp(m.ty, ambY, 0.04)
      }

      m.x = lerp(m.x, m.tx, 0.055)
      m.y = lerp(m.y, m.ty, 0.055)
      // Write to .sevenStage (already a promoted GPU layer), NOT .boot.
      // Writing custom properties to .boot invalidates the computed-style
      // cascade for every non-promoted descendant → forced repaint of HUD,
      // mfgBar, holoRing, dataStream, etc. on every frame. Scoping the
      // write to the promoted layer keeps invalidation off the main layer.
      const el = sevenStageRef.current
      if (el) {
        el.style.setProperty('--mx', m.x.toFixed(4))
        el.style.setProperty('--my', m.y.toFixed(4))
      }
      parallaxRafRef.current = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', handleMouse, { passive: true })
    window.addEventListener('touchstart', handleTouch, { passive: true })
    window.addEventListener('touchmove', handleTouch, { passive: true })
    // DeviceOrientation auto-attached on browsers that don't gate it
    // (Android, Chrome desktop). iOS 13+ requires permission flow which
    // we trigger on tap (see handleTap below) — the listener attaches
    // there once permission is granted.
    const supportsGyro = 'DeviceOrientationEvent' in window
    const needsPermission =
      supportsGyro &&
      // @ts-expect-error iOS 13+ permission API not in lib.dom
      typeof DeviceOrientationEvent.requestPermission === 'function'
    if (supportsGyro && !needsPermission) {
      window.addEventListener('deviceorientation', handleOrient, { passive: true })
    }
    // Expose for the tap handler to attach post-permission
    ;(bootDivRef as unknown as { gyroAttach?: () => void }).gyroAttach = () => {
      window.addEventListener('deviceorientation', handleOrient, { passive: true })
    }
    // Gamepad stick → parallax (LX/LY mapped to 0..1 like mouse).
    // Writes go through the same input path as mouse/touch/gyro:
    // updates m.tx/ty so the lerp tick smooths the motion.
    const writeCursor = (sx: number, sy: number) => {
      m.tx = sx
      m.ty = sy
      lastInputAtRef.current = performance.now()
      inputModeRef.current = 'mouse'
    }
    setStickCursorWriter(writeCursor)
    setMidiCursorWriter(writeCursor)

    parallaxRafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', handleMouse)
      window.removeEventListener('touchstart', handleTouch)
      window.removeEventListener('touchmove', handleTouch)
      window.removeEventListener('deviceorientation', handleOrient)
      cancelAnimationFrame(parallaxRafRef.current)
    }
  }, [])

  // Progress tick
  useEffect(() => {
    startTimeRef.current = performance.now()
    const duration = boot.progressDuration
    let raf: number

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current
      const pct = Math.min(elapsed / duration, 1)
      setProgress(pct)

      if (pct < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setLoadingDone(true)
      }
    }

    raf = requestAnimationFrame(tick)
    bus.emit('boot:start')

    return () => cancelAnimationFrame(raf)
  }, [boot])

  // Typewriter: drive step index from progress, then type chars at 30 ms/char
  useEffect(() => {
    if (loadingSteps.length === 0) return
    const targetIdx = Math.min(
      Math.floor(progress * loadingSteps.length),
      loadingSteps.length - 1,
    )
    if (targetIdx !== stepIdx) {
      setStepIdx(targetIdx)
      setTyped('')
    }
  }, [progress, loadingSteps, stepIdx])

  useEffect(() => {
    const phrase = loadingSteps[stepIdx] ?? ''
    if (!phrase) return
    if (typed.length >= phrase.length) return
    const t = setTimeout(() => {
      setTyped(phrase.slice(0, typed.length + 1))
    }, 30)
    return () => clearTimeout(t)
  }, [typed, stepIdx, loadingSteps])

  // ── Ready signal: fires once when load reaches 100% ────────────────
  // Two cues so the recruiter perceives "ready" before they consciously
  // scan the screen for it:
  //   1) Audio: subtle shimmer ping (only if AudioContext already alive
  //      — boot synths haven't been unlocked yet here; ping is silent
  //      until tap, but we kick it just in case the user pre-tapped.)
  //   2) Visual: energy surge animation on the loading bar — gold flash
  //      that signals "anticipation" before they see CONTINUE button.
  useEffect(() => {
    if (!loadingDone) return
    const fill = hudBarFillRef.current
    if (fill) {
      fill.setAttribute('data-energy-surge', 'true')
      const cleanup = setTimeout(() => fill.removeAttribute('data-energy-surge'), 700)
      // Haptic — short tick to confirm "ready" tactilely on mobile,
      // moments before the gold flash visually peaks
      haptic(12)
      return () => clearTimeout(cleanup)
    }
  }, [loadingDone])

  // Tap handler — unlock audio + fire system-online burst
  const handleTap = useCallback(async () => {
    if (tappedRef.current || !loadingDone) return
    tappedRef.current = true

    // CRITICAL: user gesture for AudioContext unlock (iOS/Safari)
    await unlockAudioContext()
    initSoundManager(audio)

    // iOS 13+ DeviceOrientation requires explicit permission, only
    // requestable from a user gesture. Best moment is the same tap that
    // unlocks audio. Silently fall back to mouse/touch if denied.
    try {
      // @ts-expect-error iOS 13+ permission API not in lib.dom
      const reqPerm = DeviceOrientationEvent?.requestPermission
      if (typeof reqPerm === 'function') {
        const result = await reqPerm()
        if (result === 'granted') {
          const attach = (bootDivRef as unknown as { gyroAttach?: () => void }).gyroAttach
          attach?.()
        }
      }
    } catch {
      // permission denied or unavailable — touch parallax still works
    }

    bus.emit('boot:tap')

    // Haptic choreography on tap — three-stage rising pattern that
    // feels like "engaging" a mechanism: short pulse → micro-pause →
    // confirm thud. Mobile only; desktop ignores silently.
    haptic([18, 35, 28])

    // Ready ping — subtle shimmer chime now that the AudioContext is
    // freshly unlocked. Played at low volume so it sits under the
    // boot:tap synth without competing.
    try { playSynthById('sfx_shimmer', 0.22) } catch { /* synth unavailable */ }

    // Scanline flash + static burst (200ms)
    setBurst(true)
    setTimeout(() => setBurst(false), 280)

    // ── Particle burst — 36 sparks fly outward from center ──
    // Skipped under prefers-reduced-motion. Spawned imperatively (DOM
    // append + CSS keyframe) instead of React state to avoid rerenders
    // and to let the layer self-clean after 1.2s.
    if (!reducedMotion) {
      const root = bootDivRef.current
      if (root) {
        const layer = document.createElement('div')
        layer.className = styles.burstLayer ?? 'burstLayer'
        layer.setAttribute('aria-hidden', 'true')
        const N = 36
        for (let i = 0; i < N; i++) {
          const sp = document.createElement('span')
          sp.className = styles.burstParticle ?? 'burstParticle'
          const angle = (i / N) * Math.PI * 2
          // Mix radius so explosion isn't a perfect circle — feels organic
          const distance = 38 + Math.random() * 32 // vmax units
          const dx = Math.cos(angle) * distance
          const dy = Math.sin(angle) * distance
          sp.style.setProperty('--bx', `${dx.toFixed(2)}vmax`)
          sp.style.setProperty('--by', `${dy.toFixed(2)}vmax`)
          sp.style.setProperty('--bd', `${(0.55 + Math.random() * 0.35).toFixed(2)}s`)
          // Tri-color rotation: gold (warm hero), cyan (neon highlight),
          // ivory (energy core white). Roughly 1:1:1 distribution.
          const palette = i % 3 === 0
            ? '#f0d878' // gold
            : i % 3 === 1
              ? '#22e8ff' // neon cyan
              : '#fff8e0' // ivory white
          sp.style.setProperty('--bc', palette)
          layer.appendChild(sp)
        }
        root.appendChild(layer)
        setTimeout(() => layer.remove(), 1200)
      }
    }

    // Exit after burst
    setTimeout(() => setExiting(true), 180)

    setTimeout(() => {
      bus.emit('boot:complete')
      onComplete()
    }, 900)
  }, [loadingDone, audio, onComplete, reducedMotion])

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        handleTap()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleTap])

  const percent = Math.round(progress * 100)

  return (
    <div
      ref={bootDivRef}
      className={`${styles.boot} ${exiting ? styles.bootExit : ''}`}
      onClick={handleTap}
      role="button"
      tabIndex={0}
      aria-label="Tap to begin"
    >
      {/* Background layer 0 — WebGL nebula (procedural cyan/violet/gold flow) */}
      <CyberNebula parallaxRef={mouseLerpRef} reducedMotion={reducedMotion} />

      {/* Background layer 1 — WebGPU 32k particle compute field, additively
          blended over the nebula. Activates only on Chromium 113+ / Safari TP
          and silently no-ops on browsers without navigator.gpu. */}
      <QuantumField parallaxRef={mouseLerpRef} reducedMotion={reducedMotion} />

      {/* Mid-back layer 3 — casino symbols (coins, dice, chips, stars)
          orbit BEHIND Lucky 7 so they tuck visibly behind the figure */}
      <CasinoField parallaxRef={mouseLerpRef} reducedMotion={reducedMotion} />

      {/* Data stream background — columns of hex cascading downward */}
      <div className={styles.dataStream} aria-hidden="true">
        {streamColumns.map((c, i) => (
          <pre
            key={i}
            className={[
              styles.streamCol,
              c.bright ? styles.streamColBright : '',
              c.glitch ? styles.streamColGlitch : '',
            ].filter(Boolean).join(' ')}
            style={{
              left: c.left,
              animationDelay: c.delay,
              animationDuration: c.duration,
              ...(c.glitch ? { '--glitch-delay': c.glitchDelay } as React.CSSProperties : {}),
            }}
          >
            {c.text}
          </pre>
        ))}
      </div>

      {/* Manufacturer gold bar */}
      <div className={styles.mfgBar} />

      {/* Fullscreen Lucky 7 — blur focus loader.
          ref carries the parallax CSS-var writes (--mx/--my) so they
          stay scoped to this element's already-promoted GPU layer. */}
      <div
        ref={sevenStageRef}
        className={styles.sevenStage}
        style={{ '--seven-progress': progress } as React.CSSProperties}
        aria-hidden="true"
      >
        <img
          src="/seven-cyber.png"
          alt=""
          className={styles.sevenFull}
          draggable={false}
        />
      </div>

      {/* Cinematic tagline (P3.1) — 3-line manifesto anchoring the
          slot-machine metaphor before the recruiter taps in. */}
      <BootTagline exiting={exiting} />

      {/* Loading HUD — typewriter step + % + bar */}
      <div className={styles.hud} aria-live="polite">
        <div className={styles.hudLine}>
          <span className={styles.hudPrompt}>&gt; NEURAL&nbsp;SYNC</span>
          <span className={styles.hudPct}>{percent.toString().padStart(3, '0')}%</span>
        </div>
        <div className={styles.hudStep}>
          {typed}
          <span className={styles.caret} />
        </div>
        <div className={styles.hudBar}>
          <div
            ref={hudBarFillRef}
            className={styles.hudBarFill}
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </div>

      {/* CONTINUE — holographic ring pulse when ready */}
      <div className={styles.continueWrap}>
        <div
          className={`${styles.holoRing} ${loadingDone ? styles.holoRingActive : ''}`}
          aria-hidden="true"
        />
        <button
          className={`${styles.tapBtn} ${loadingDone ? styles.tapBtnVisible : ''}`}
          type="button"
          disabled={!loadingDone}
          aria-hidden={!loadingDone}
          aria-label="Tap to continue"
        >
          CONTINUE
        </button>
      </div>

      {/* Mobile finger-tap cue — only on touch devices, only post-load */}
      {mobile && (
        <div
          className={`${styles.tapHint} ${loadingDone ? styles.tapHintVisible : ''}`}
          aria-hidden="true"
        >
          <span className={styles.tapHintDot} />
          <span>Tap anywhere to begin</span>
          <span className={styles.tapHintDot} />
        </div>
      )}

      {/* Holographic name — forms from particles as 7 comes into focus */}
      <div
        className={`${styles.hologramName} ${progress >= 0.55 ? styles.hologramNameVisible : ''}`}
        aria-hidden="true"
      >
        BOJAN PETKOVIĆ
      </div>

      {/* Version bar — IGT-style asset code + live LED */}
      <div className={styles.versionBar}>
        <span className={styles.versionLed} aria-hidden="true" />
        <span>CORTEX&nbsp;ENGINE&nbsp;v1.0</span>
        <span className={styles.versionPipe} aria-hidden="true">·</span>
        <span className={styles.versionSerial}>{serial}</span>
        <span className={styles.versionPipe} aria-hidden="true">·</span>
        <span>PORTFOLIO&nbsp;SYSTEM</span>
      </div>

      {/* System-online burst — radial scanline flash + static noise */}
      {burst && <div className={styles.systemBurst} aria-hidden="true" />}
    </div>
  )
}

export default BootScreen
