/**
 * CabinetVoxelFloor — V5.0 Tron-style perspective grid floor.
 *
 * V7.2 — adds a reactive scan-ripple layer. When the slot:reel:land
 * event fires, a luminous concentric ring expands outward from the
 * cabinet centerline along the floor — sells the "energy discharge"
 * moment without touching the cabinet itself. Re-mounted via key
 * increment on each event so the CSS animation restarts cleanly.
 *
 * Sits BELOW the cabinet frame (above CabinetWorld parallax), giving
 * the impression that the cabinet is standing on a luminous grid
 * extending into the horizon. CSS-only — perspective + repeating
 * gradient + animated background-position scroll.
 *
 * Three layers compose the floor:
 *   .grid    — repeating cyan grid lines, scrolling forward (toward camera)
 *   .haze    — horizontal mist band fading the far edge of the grid
 *   .ripple  — V7.2 transient scan ring on slot:reel:land
 *
 * Active only in phase=slot. Reduced-motion stops scroll + ripple.
 */

import { useEffect, useState } from 'react'
import { bus } from '../../../engine'
import styles from './CabinetVoxelFloor.module.css'

export function CabinetVoxelFloor() {
  // V7.2 — increment on each reel-land so React re-mounts the ripple
  // div with a fresh `key` and the CSS animation restarts cleanly
  // (instead of a single instance that only fires once per page load).
  const [ripple, setRipple] = useState(0)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let lastFired = 0
    const off = bus.on('slot:reel:land', () => {
      // Only fire on the FIRST reel landing per spin (5 reels land in
      // succession; we don't want 5 stacked ripples). 600ms cooldown.
      const now = performance.now()
      if (now - lastFired < 600) return
      lastFired = now
      setRipple((n) => n + 1)
    })
    return off
  }, [])

  return (
    <div className={styles.floor} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.haze} />
      {ripple > 0 && (
        <div key={ripple} className={styles.ripple} />
      )}
    </div>
  )
}

export default CabinetVoxelFloor
