/**
 * CellBackground — color base + shimmer sweep + cursor spotlight + neon
 * outline (when center). Each layer is a positioned absolute div and
 * carries its own z-index. Read entirely from CellContext.
 *
 * Splits cleanly out of the legacy monolithic Cell.tsx so a future
 * cell variant (waveform, animated demo) can reuse the same background
 * stack without copy-paste.
 */

import styles from '../Cell.module.css'
import { useCellContext } from './CellContext'

export function CellBackground() {
  const { data, isCenter } = useCellContext()
  const bgStyle = data.color ? { background: data.color } : {}

  return (
    <>
      {/* Ambient color layer — per-project palette */}
      <div className={styles.colorBg} style={bgStyle} />
      {/* Holographic shimmer sweep (CSS-driven on hover) */}
      <div className={styles.shimmer} aria-hidden />
      {/* Cursor spotlight — follows --cx/--cy set by Shell */}
      <div className={styles.spotlight} aria-hidden />
      {/* Neon animated outline only on the center (winning) cell */}
      {isCenter && (
        <svg className={styles.neonOutline} aria-hidden>
          <rect x="1.5" y="1.5" width="calc(100% - 3px)" height="calc(100% - 3px)" rx="4" ry="4" />
        </svg>
      )}
    </>
  )
}

export default CellBackground
