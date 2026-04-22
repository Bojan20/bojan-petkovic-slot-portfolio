/**
 * BootScreen — Slot Machine Boot Sequence
 *
 * Modeled after real IGT/Aristocrat cabinet power-on:
 * - Dark screen, manufacturer gold bar, CRT scanlines, vignette
 * - Simulated loading progress (font, three.js, audio preload)
 * - "TAP TO BEGIN" — unlocks AudioContext (user gesture)
 *
 * After tap: fade out → splash starts with FULL AUDIO capability.
 * This solves the browser autoplay restriction permanently.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { bus, unlockAudioContext, initSoundManager, portfolioConfig } from '../engine'
import styles from './BootScreen.module.css'

interface BootScreenProps {
  onComplete: () => void
}

export function BootScreen({ onComplete }: BootScreenProps) {
  const [progress, setProgress] = useState(0)
  const [loadingDone, setLoadingDone] = useState(false)
  const [exiting, setExiting] = useState(false)
  const tappedRef = useRef(false)
  const startTimeRef = useRef(0)

  const { boot, audio } = portfolioConfig

  // Simulated loading progress — drives the seven blur focus
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

  // Handle tap — unlock audio, init SoundManager, exit
  const handleTap = useCallback(async () => {
    if (tappedRef.current || !loadingDone) return
    tappedRef.current = true

    // CRITICAL: This runs inside user gesture handler — browser allows AudioContext unlock
    await unlockAudioContext()

    // Initialize the SoundManager with JSON config (event → sound mappings)
    initSoundManager(audio)

    // Emit boot:tap (plays sfx_boot_hum via SoundManager)
    bus.emit('boot:tap')

    // Short delay for the boot SFX to play, then exit
    setExiting(true)

    // Wait for exit animation (800ms CSS), then emit complete
    setTimeout(() => {
      bus.emit('boot:complete')
      onComplete()
    }, 800)
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

  return (
    <div
      className={`${styles.boot} ${exiting ? styles.bootExit : ''}`}
      onClick={handleTap}
      role="button"
      tabIndex={0}
      aria-label="Tap to begin"
    >
      {/* Manufacturer gold bar */}
      <div className={styles.mfgBar} />

      {/* Fullscreen Lucky 7 — blurs from 40px to 0 as loading completes */}
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

      {/* CONTINUE — appears under the 7 once loading completes */}
      <div className={styles.continueWrap}>
        <button
          className={`${styles.tapBtn} ${loadingDone ? styles.tapBtnVisible : ''}`}
          type="button"
          disabled={!loadingDone}
          aria-hidden={!loadingDone}
        >
          CONTINUE
        </button>
      </div>

      {/* Version bar */}
      <div className={styles.versionBar}>
        CORTEX ENGINE v1.0 — PORTFOLIO SYSTEM
      </div>
    </div>
  )
}

export default BootScreen
