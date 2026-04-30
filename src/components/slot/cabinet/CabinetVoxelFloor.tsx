/**
 * CabinetVoxelFloor — V5.0 Tron-style perspective grid floor.
 *
 * Sits BELOW the cabinet frame (above CabinetWorld parallax), giving
 * the impression that the cabinet is standing on a luminous grid
 * extending into the horizon. CSS-only — perspective + repeating
 * gradient + animated background-position scroll.
 *
 * Two layers compose the floor:
 *   .grid  — repeating cyan grid lines, scrolling forward (toward camera)
 *   .haze  — horizontal mist band fading the far edge of the grid
 *
 * Active only in phase=slot. Reduced-motion stops the scroll.
 */

import styles from './CabinetVoxelFloor.module.css'

export function CabinetVoxelFloor() {
  return (
    <div className={styles.floor} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.haze} />
    </div>
  )
}

export default CabinetVoxelFloor
