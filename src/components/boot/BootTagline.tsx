/**
 * BootTagline — three-line manifesto on the boot screen.
 *
 *   "Audio is a game of chance."
 *   "Forty wins."
 *   "Zero defects."
 *
 * Anchors the slot-machine metaphor BEFORE the recruiter ever taps
 * to enter — the moment they see this, the metaphor is no longer
 * decorative. The slot is the thesis statement.
 *
 * Each line renders as character-spans with --i (cascade index) and
 * --d (per-line start delay) custom properties; CSS keyframes do
 * the rest. No GSAP, no JS RAF — this is pure CSS choreography.
 *
 * Lifecycle:
 *   • Reveals 800ms after BootScreen mount (set in CSS, gives the
 *     loading bar a beat to register before the eye descends here)
 *   • Stays visible until the boot phase exits (`exiting` class
 *     triggers fade-out aligned with the existing boot exit)
 *
 * Reads under prefers-reduced-motion as a static block — no blur,
 * no translate, no per-char animation.
 */

import styles from './BootTagline.module.css'

const LINES = [
  'Audio is a game of chance.',
  'Forty wins.',
  'Zero defects.',
] as const

// Per-line start delay so each line begins after the previous is
// roughly 60% revealed. Tuned visually — adjust if the cascade
// feels lazy or rushed.
const LINE_DELAYS = [0, 540, 880] as const

interface BootTaglineProps {
  /** When true, runs the fade-out animation (sync with boot exit). */
  exiting?: boolean
}

export function BootTagline({ exiting = false }: BootTaglineProps) {
  return (
    <div
      className={`${styles.tagline} ${exiting ? styles.exiting : ''}`}
      role="presentation"
      aria-hidden="true"
    >
      {LINES.map((line, lineIdx) => {
        const baseDelay = LINE_DELAYS[lineIdx] ?? 0
        return (
          <span key={lineIdx} className={styles.line}>
            {[...line].map((ch, i) => (
              <span
                key={i}
                className={styles.char}
                style={{
                  ['--i' as string]: i,
                  ['--d' as string]: `${baseDelay}ms`,
                }}
              >
                {ch}
              </span>
            ))}
          </span>
        )
      })}
    </div>
  )
}

export default BootTagline
