/**
 * CabinetMarquee — top scrolling brand ticker (V3.0 Foundation).
 *
 * Sits above the reel zone. Always-visible brand identity:
 * "VANVINKL · BOJAN PETKOVIĆ · AUDIO DIRECTOR · 8YR · 50+ TITLES · ..."
 *
 * Loops via CSS keyframe — pure CSS so the GPU compositor handles it
 * without JS work. Pauses under prefers-reduced-motion (CSS-gated).
 *
 * Three duplicate spans are rendered so the loop hides the seam — when
 * the first span exits left, the third has already replaced it on the
 * right via translateX(-100%) — same trick as classic news tickers.
 */

import styles from './CabinetMarquee.module.css'

const MARQUEE_TEXT =
  '◆ VANVINKL · BOJAN PETKOVIĆ · AUDIO DIRECTOR · 8 YEARS · 50+ TITLES · WWISE · FMOD · UNREAL · UNITY · PRO TOOLS · REAPER · CUBASE · '

export function CabinetMarquee() {
  return (
    <div
      className={styles.marquee}
      role="marquee"
      aria-label="Vanvinkl Studio · Bojan Petković · Audio Director · 8 years · 50+ titles"
    >
      <div className={styles.track} aria-hidden="true">
        <span className={styles.text}>{MARQUEE_TEXT}</span>
        <span className={styles.text}>{MARQUEE_TEXT}</span>
        <span className={styles.text}>{MARQUEE_TEXT}</span>
      </div>
    </div>
  )
}

export default CabinetMarquee
