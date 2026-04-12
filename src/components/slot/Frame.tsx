/**
 * Frame — WoO-style slot machine frame
 *
 * Fluted gold pillars (left/right), corner medallions, chrome rail.
 * Children = the reel grid area.
 */

import { memo, type ReactNode } from 'react'
import styles from './Frame.module.css'

interface FrameProps {
  children: ReactNode
}

const Frame = memo(function Frame({ children }: FrameProps) {
  return (
    <div className={styles.frame}>
      {/* Left pillar */}
      <div className={`${styles.pillar} ${styles.left}`}>
        <span className={styles.gleam} />
        <span className={`${styles.gleam} ${styles.gleam2}`} />
      </div>

      {/* Reel area */}
      <div className={styles.reelArea}>{children}</div>

      {/* Right pillar */}
      <div className={`${styles.pillar} ${styles.right}`}>
        <span className={styles.gleam} />
        <span className={`${styles.gleam} ${styles.gleam2}`} />
      </div>

      {/* Corner medallions */}
      <span className={`${styles.medallion} ${styles.mtl}`} />
      <span className={`${styles.medallion} ${styles.mtr}`} />
      <span className={`${styles.medallion} ${styles.mbl}`} />
      <span className={`${styles.medallion} ${styles.mbr}`} />
    </div>
  )
})

export default Frame
