/**
 * RecIndicator — top-right blinking ● REC chip while a portfolio reel
 * is being captured. Polls getReelDurationMs() at 4Hz to update the
 * timer (no React state churn while idle, no RAF either).
 *
 * Visibility is bound to the `[data-recording]` attribute that
 * PortfolioReel sets on <body> when capture starts, so this component
 * doesn't need to subscribe to the EventBus or own state — it can
 * just re-render whenever its parent does and read DOM truth.
 *
 * In practice we wire it to two events (start/stop) so we don't paint
 * the timer when nothing is happening. Cheap and correct.
 */

import { useEffect, useRef, useState } from 'react'
import styles from './RecIndicator.module.css'
import { bus, getReelDurationMs } from '../engine'

function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function RecIndicator() {
  const [recording, setRecording] = useState(false)
  const [tick, setTick] = useState('00:00')
  const intervalRef = useRef(0)

  useEffect(() => {
    const offStart = bus.on('custom:reel:start', () => setRecording(true))
    const offStop = bus.on('custom:reel:saved', () => setRecording(false))
    const offCancel = bus.on('custom:reel:stop', () => setRecording(false))
    return () => {
      offStart()
      offStop()
      offCancel()
    }
  }, [])

  useEffect(() => {
    if (!recording) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = 0
      setTick('00:00')
      return
    }
    // 4Hz update — fast enough to read seconds smoothly, slow enough
    // to not show up in the perf overlay
    intervalRef.current = window.setInterval(() => {
      setTick(formatTimer(getReelDurationMs()))
    }, 250)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = 0
    }
  }, [recording])

  if (!recording) return null

  return (
    <div className={styles.indicator} role="status" aria-live="polite" aria-label="Recording portfolio reel">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>REC {tick}</span>
    </div>
  )
}

export default RecIndicator
