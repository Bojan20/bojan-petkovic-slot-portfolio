/**
 * CabinetLetterbox — V4.3 cinematic 2.39:1 letterbox bars.
 *
 * Hollywood ratio. Top + bottom black bars slide in to reveal the
 * "scope" frame around the action; slide out at the end. Used during
 * cinematic transitions (boot→splash, splash→slot, payline takeover)
 * to signal "this is the cinematic moment, the camera has framed it".
 *
 * Driven by body[data-letterbox]:
 *   "" or absent       — bars hidden, translateY ±100%
 *   "active"           — bars slid in to 80px (or clamp on small screens)
 *   "thick"            — bars slid in to 110px (deep-focus reveal)
 *
 * Pure CSS animation. Component just renders the two bars; the active
 * data attribute is set/unset by TransitionDirector + paylineTakeover.
 */

import styles from './CabinetLetterbox.module.css'

export function CabinetLetterbox() {
  return (
    <>
      <div className={`${styles.bar} ${styles.barTop}`} aria-hidden="true" />
      <div className={`${styles.bar} ${styles.barBottom}`} aria-hidden="true" />
    </>
  )
}

export default CabinetLetterbox
