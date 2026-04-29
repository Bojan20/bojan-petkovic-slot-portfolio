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

import { useEffect, useState } from 'react'
import styles from './BootTagline.module.css'

const LINES_DESKTOP = [
  'Audio is a game of chance.',
  'Forty wins.',
  'Zero defects.',
] as const

// Mobile collapse: only the thesis line renders. Lines 2 and 3 are
// supporting stats — on a 390px viewport they either wrap awkwardly
// or shrink below readable. A single bold line carries the metaphor
// in 3 seconds, which is what the mobile recruiter has anyway.
const LINES_MOBILE = [
  'Audio is a game of chance.',
] as const

const LINE_DELAYS_DESKTOP = [0, 540, 880] as const
const LINE_DELAYS_MOBILE  = [0] as const

/** Lightweight matchMedia hook with SSR + listener cleanup. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

interface BootTaglineProps {
  /** When true, runs the fade-out animation (sync with boot exit). */
  exiting?: boolean
}

export function BootTagline({ exiting = false }: BootTaglineProps) {
  // Match either touch device OR narrow viewport — second rule catches
  // testing tools (Playwright) and narrow desktop browser windows that
  // emulate mobile via viewport size only without setting pointer:coarse.
  const isMobile = useMediaQuery('(hover: none) and (pointer: coarse), (max-width: 640px)')
  const LINES        = isMobile ? LINES_MOBILE        : LINES_DESKTOP
  const LINE_DELAYS  = isMobile ? LINE_DELAYS_MOBILE  : LINE_DELAYS_DESKTOP
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
