/**
 * CabinetSubFrame — bottom cyan ticker (V3.0 Foundation).
 *
 * Persistent recruitment-CTA strip at the very bottom of the cabinet.
 * Shows availability + contact in a quiet always-on band so the
 * recruiter can't miss the "how do I reach this person?" answer.
 *
 * The pulsing dot on either side gives the strip a "transmission live"
 * feel — not a static footer.
 */

import styles from './CabinetSubFrame.module.css'

export function CabinetSubFrame() {
  return (
    <a
      href="mailto:bojan.petkovic25@gmail.com"
      className={styles.subFrame}
      aria-label="Available for hire — contact Bojan Petković at bojan.petkovic25@gmail.com"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.text}>
        AVAILABLE FOR HIRE · CONTACT BOJAN.PETKOVIC25@GMAIL.COM · BELGRADE · REMOTE / RELO
      </span>
      <span className={styles.dot} aria-hidden="true" />
    </a>
  )
}

export default CabinetSubFrame
