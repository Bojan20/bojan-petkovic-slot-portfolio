/**
 * SkipIntroButton — courtesy escape hatch from the cinematic intro.
 *
 * Visible only during boot / splash / entering phases. On click,
 * delegates to TransitionDirector.skip() which jumps the master
 * timeline to slot_ready. Honors UX panel guideline: cinematic
 * intros must never trap the user.
 */

import styles from './SkipIntroButton.module.css'
import { getTransitionDirector } from '../engine'

interface SkipIntroButtonProps {
  visible: boolean
}

export function SkipIntroButton({ visible }: SkipIntroButtonProps) {
  if (!visible) return null

  const handleSkip = () => {
    const director = getTransitionDirector()
    director?.skip()
  }

  return (
    <button
      type="button"
      className={styles.skip}
      onClick={handleSkip}
      aria-label="Skip intro"
      title="Skip intro (jumps to portfolio)"
    >
      SKIP INTRO
      <span className={styles.skipArrow} aria-hidden="true">▸▸</span>
    </button>
  )
}

export default SkipIntroButton
