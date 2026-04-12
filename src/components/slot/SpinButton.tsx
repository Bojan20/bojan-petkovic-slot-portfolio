/**
 * SpinButton — WoO circular design
 *
 * Dark metal gradient, gold border, pulsing ring animation.
 * Disabled during spin, wiggle animation when idle.
 */

import { memo } from 'react'
import styles from './SpinButton.module.css'

interface SpinButtonProps {
  isSpinning: boolean
  onClick: () => void
}

const SpinButton = memo(function SpinButton({
  isSpinning,
  onClick,
}: SpinButtonProps) {
  return (
    <div className={styles.wrapper}>
      {/* Pulsing ring */}
      <span
        className={`${styles.ring} ${isSpinning ? styles.spinning : ''}`}
      />

      <button
        className={`${styles.btn} ${isSpinning ? styles.disabled : styles.idle}`}
        onClick={onClick}
        disabled={isSpinning}
        aria-label={isSpinning ? 'Spinning...' : 'Spin the reels'}
      >
        <span className={styles.label}>
          {isSpinning ? '⏳' : 'SPIN'}
        </span>
      </button>
    </div>
  )
})

export default SpinButton
