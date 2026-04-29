/**
 * PullToRefresh — custom touch gesture handler for mobile reload
 *
 * The boot/splash/slot phases each disable native overscroll because
 * they own touch input (parallax / orientation / spin gestures), which
 * also kills the iOS / Android browser pull-to-refresh. Recruiters
 * still expect "drag from top → reload" — so we re-implement it here.
 *
 * Mechanics:
 *   • touchstart anywhere → record startY
 *   • touchmove → if delta is downward AND vertical-dominant, apply
 *     resistance (delta * 0.45) up to MAX_PULL, drive --p2r-pull CSS var
 *     and --p2r-progress (0..1 of THRESHOLD)
 *   • touchend → if progress >= 1, animate a final "snap" then reload;
 *     otherwise spring the indicator back
 *
 * Touch events use `passive: true` because we don't preventDefault —
 * we run alongside any other gesture (parallax, splash tap-to-enter,
 * slot swipe). The component is invisible until the user actually pulls.
 *
 * Hidden in the slot phase so a downward swipe inside a reel doesn't
 * accidentally fire the reload — controlled by the optional `enabled` prop.
 */

import { useEffect, useRef, useState } from 'react'
import styles from './PullToRefresh.module.css'

interface PullToRefreshProps {
  /** Master switch — caller decides when P2R should be live (e.g. only
   *  during boot/splash, not during slot interactions). Default true. */
  enabled?: boolean
  /** Pixels of pull required to fire reload. Default 80. */
  threshold?: number
  /** Cap how far the indicator can stretch even past threshold. */
  maxPull?: number
}

type GestureState = 'idle' | 'tracking' | 'releasing' | 'refreshing'

export function PullToRefresh({
  enabled = true,
  threshold = 80,
  maxPull = 130,
}: PullToRefreshProps) {
  const indicatorRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startXRef = useRef(0)
  const trackingRef = useRef(false)
  const stateRef = useRef<GestureState>('idle')
  const [progress, setProgress] = useState(0)
  const [armed, setArmed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [visible, setVisible] = useState(false)
  const [releasing, setReleasing] = useState(false)

  useEffect(() => {
    if (!enabled) return

    const indicator = indicatorRef.current

    const setPull = (px: number) => {
      indicator?.style.setProperty('--p2r-pull', `${px}px`)
      const p = Math.min(px / threshold, 1.4)
      indicator?.style.setProperty('--p2r-progress', p.toFixed(3))
      setProgress(p)
      setArmed(p >= 1)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (refreshing) return
      // Single-finger, near top of viewport — gives parallax / multi-touch
      // gestures elsewhere full latitude.
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      if (!t) return
      // Only arm if pull would start near the top — avoids triggering
      // when the user swipes down inside the slot reel mid-screen.
      if (t.clientY > window.innerHeight * 0.5) return
      startYRef.current = t.clientY
      startXRef.current = t.clientX
      trackingRef.current = true
      stateRef.current = 'tracking'
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current || refreshing) return
      const t = e.touches[0]
      if (!t) return
      const dy = t.clientY - startYRef.current
      const dx = t.clientX - startXRef.current

      // Need downward + vertically dominant motion. Otherwise the user is
      // doing a horizontal swipe (e.g. slot section change) and we yield.
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) * 0.7) {
        if (visible) {
          setVisible(false)
          setPull(0)
        }
        return
      }

      // Resistance curve — feels like rubber, capped at maxPull
      const resisted = Math.min(dy * 0.45, maxPull)
      setPull(resisted)
      if (!visible && resisted > 6) setVisible(true)
    }

    const handleTouchEnd = () => {
      if (!trackingRef.current) return
      trackingRef.current = false
      if (refreshing) return

      if (progress >= 1) {
        // Lock indicator + reload after a beat so user sees the gold flash
        stateRef.current = 'refreshing'
        setRefreshing(true)
        // Hold the indicator at threshold during the reload animation
        indicator?.style.setProperty('--p2r-pull', `${threshold}px`)
        // Brief moment for the spinner to register, then full reload
        setTimeout(() => {
          window.location.reload()
        }, 380)
      } else {
        // Snap back
        stateRef.current = 'releasing'
        setReleasing(true)
        setPull(0)
        setTimeout(() => {
          setReleasing(false)
          setVisible(false)
          stateRef.current = 'idle'
        }, 340)
      }
    }

    const handleTouchCancel = handleTouchEnd

    // Passive listeners — we don't preventDefault, just observe
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [enabled, threshold, maxPull, refreshing, progress, visible])

  if (!enabled) return null

  const cls = [
    styles.indicator,
    visible ? styles.indicatorVisible : '',
    releasing ? styles.indicatorReleasing : '',
    refreshing ? styles.indicatorRefreshing : '',
  ].filter(Boolean).join(' ')

  const label = refreshing
    ? 'Reloading…'
    : armed
      ? 'Release to reload'
      : 'Pull to refresh'

  return (
    <div ref={indicatorRef} className={cls} role="status" aria-live="polite">
      {refreshing ? (
        <div className={styles.spinner} aria-hidden="true" />
      ) : (
        <div
          className={`${styles.chevron} ${armed ? styles.chevronArmed : ''}`}
          aria-hidden="true"
        />
      )}
      <div className={`${styles.label} ${armed && !refreshing ? styles.labelArmed : ''}`}>
        {label}
      </div>
    </div>
  )
}

export default PullToRefresh
