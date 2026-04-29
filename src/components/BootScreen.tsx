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
import { bus, unlockAudioContext, initSoundManager, portfolioConfig } from '../engine'
import styles from './BootScreen.module.css'

interface BootScreenProps {
  onComplete: () => void
}

/* ── Data stream columns ─ seeded randomness keeps SSR/CSR parity ── */
const HEX_CHARS = '0123456789ABCDEF'
const STREAM_COLS = 24
const STREAM_ROWS = 48

function seeded(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

function buildStreamText(col: number): string {
  let out = ''
  for (let r = 0; r < STREAM_ROWS; r++) {
    const idx = Math.floor(seeded(col * 101 + r * 7) * HEX_CHARS.length)
    out += HEX_CHARS[idx]
    if (r % 4 === 3) out += ' '
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
  const mouseLerpRef = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 })
  const parallaxRafRef = useRef(0)
  // Gyroscope calibration baseline — captured on first reading so resting
  // phone pose maps to (0.5, 0.5). Avoids the "7 lurches sideways" feel
  // recruiters get when they pick up the phone in landscape.
  const gyroBaselineRef = useRef<{ beta: number; gamma: number } | null>(null)
  const lastInputAtRef = useRef(performance.now())
  const inputModeRef = useRef<'idle' | 'mouse' | 'touch' | 'gyro'>('idle')

  const { boot, audio } = portfolioConfig
  const loadingSteps: string[] = boot.loadingSteps ?? []

  // Pre-compute data stream columns once
  const streamColumns = useMemo(
    () => Array.from({ length: STREAM_COLS }, (_, i) => ({
      text: buildStreamText(i),
      delay: `${seeded(i * 13) * 4}s`,
      duration: `${3.5 + seeded(i * 17) * 3.5}s`,
      left: `${(i / STREAM_COLS) * 100}%`,
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
      // hovering a mouse.
      if (idleFor > 1500) {
        const t = now * 0.0006
        const ambX = 0.5 + Math.sin(t) * 0.10
        const ambY = 0.5 + Math.cos(t * 0.85) * 0.08
        m.tx = lerp(m.tx, ambX, 0.04)
        m.ty = lerp(m.ty, ambY, 0.04)
      }

      m.x = lerp(m.x, m.tx, 0.055)
      m.y = lerp(m.y, m.ty, 0.055)
      const el = bootDivRef.current
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

    // Scanline flash + static burst (200ms)
    setBurst(true)
    setTimeout(() => setBurst(false), 280)

    // Exit after burst
    setTimeout(() => setExiting(true), 180)

    setTimeout(() => {
      bus.emit('boot:complete')
      onComplete()
    }, 900)
  }, [loadingDone, audio, onComplete])

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
      {/* Data stream background — columns of hex cascading downward */}
      <div className={styles.dataStream} aria-hidden="true">
        {streamColumns.map((c, i) => (
          <pre
            key={i}
            className={styles.streamCol}
            style={{
              left: c.left,
              animationDelay: c.delay,
              animationDuration: c.duration,
            }}
          >
            {c.text}
          </pre>
        ))}
      </div>

      {/* Manufacturer gold bar */}
      <div className={styles.mfgBar} />

      {/* Fullscreen Lucky 7 — blur focus loader */}
      <div
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
        >
          CONTINUE
        </button>
      </div>

      {/* Holographic name — forms from particles as 7 comes into focus */}
      <div
        className={`${styles.hologramName} ${progress >= 0.55 ? styles.hologramNameVisible : ''}`}
        aria-hidden="true"
      >
        BOJAN PETKOVIĆ
      </div>

      {/* Version bar */}
      <div className={styles.versionBar}>
        CORTEX ENGINE v1.0 — PORTFOLIO SYSTEM
      </div>

      {/* System-online burst — radial scanline flash + static noise */}
      {burst && <div className={styles.systemBurst} aria-hidden="true" />}
    </div>
  )
}

export default BootScreen
