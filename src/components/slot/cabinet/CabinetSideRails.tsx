/**
 * CabinetSideRails — LED chase rails (V3.0 Foundation).
 *
 * Replaces the V1 "fluted gold pillars" + "corner medallions" with
 * thin neon LED strips on each side of the reel zone. A bright pulse
 * chases up/down the rail every few seconds — gives the cabinet that
 * "live LED hardware" feel of Stake / Hacksaw / Push Gaming machines.
 *
 * Pure CSS — no JS animation loop. Pauses under reduced-motion.
 */

import styles from './CabinetSideRails.module.css'

export function CabinetSideRails() {
  return (
    <>
      <div
        className={`${styles.rail} ${styles.railLeft}`}
        aria-hidden="true"
      >
        <div className={styles.chase} />
      </div>
      <div
        className={`${styles.rail} ${styles.railRight}`}
        aria-hidden="true"
      >
        <div className={styles.chase} />
      </div>
    </>
  )
}

export default CabinetSideRails
