/**
 * CabinetAnticipation — V3.8 last-reel anticipation effect.
 *
 * Listens for custom:slot:anticipation:start (emitted by SlotMachine
 * when a high-excitement row ≥ 0.4 is about to be revealed by the
 * last reel) and renders a fullscreen "?" hologram with a rising
 * audio warp tone. Cleared on custom:slot:anticipation:end (the
 * moment the last reel actually lands).
 *
 * Visual: a centered, slowly rotating "?" with chromatic aberration
 * (rgb split) + glitch jitter + a translucent radial pulse behind
 * it. Sound: sfx_warp_ignite at 0.4 volume, scaled by the excitement
 * delta — bigger jackpot anticipation = louder, more urgent sweep.
 *
 * Pointer-events:none so it never blocks anything beneath. Sits at
 * z-index 8500 (above reels, below CabinetWinFx at 9000 so the win
 * paint covers the question mark cleanly).
 */

import { useEffect, useState } from 'react'
import { bus, playSynthById } from '../../../engine'
import styles from './CabinetAnticipation.module.css'

export function CabinetAnticipation() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const offStart = bus.on(
      'custom:slot:anticipation:start' as 'custom:slot:anticipation:start',
      (p) => {
        const data = p as { excitement: number; lastCol: number }
        const excitement = data.excitement ?? 0.5
        setActive(true)
        try {
          // sfx_warp_ignite — saw sweep + noise rise, perfect for tension
          playSynthById('sfx_warp_ignite', Math.min(0.55, 0.32 + excitement * 0.25))
        } catch {
          /* audio not unlocked */
        }
      },
    )
    const offEnd = bus.on(
      'custom:slot:anticipation:end' as 'custom:slot:anticipation:end',
      () => setActive(false),
    )
    return () => { offStart(); offEnd() }
  }, [])

  if (!active) return null

  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.bloom} />
      <div className={styles.qmark}>?</div>
      <div className={`${styles.qmark} ${styles.qmarkGhostA}`}>?</div>
      <div className={`${styles.qmark} ${styles.qmarkGhostB}`}>?</div>
      <div className={styles.scan} />
    </div>
  )
}

export default CabinetAnticipation
