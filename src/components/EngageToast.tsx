/**
 * EngageToast — soft funnel 60s toast (§2.11)
 *
 * Appears once after 60s of slot engagement. Suggests contacting
 * without blocking anything. Dismissible. Routes to REACH tab on click.
 */

import { bus } from '../engine'
import styles from './EngageToast.module.css'

interface EngageToastProps {
  visible: boolean
  onDismiss: () => void
}

export function EngageToast({ visible, onDismiss }: EngageToastProps) {
  if (!visible) return null

  const handleReach = () => {
    bus.emit('custom:go_to_reach' as 'custom:go_to_reach', null as unknown)
    onDismiss()
  }

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.msg}>Enjoying the work?</span>
      <button className={styles.cta} onClick={handleReach} type="button">
        Reach out ↗
      </button>
      <button className={styles.dismiss} onClick={onDismiss} type="button" aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}

export default EngageToast
