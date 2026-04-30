/**
 * GameContent — Hero project tile (P4.1 upgrade)
 *
 * Used by section 'projects' col 0 (the project chooser). This is the
 * cell the recruiter's eye lands on first — V2 architecture treats it
 * as a HERO TILE, not a row item:
 *
 *   • Per-project palette glow ring around the icon (uses data.color)
 *   • Pulsating outer halo (only on center cell, idle ambient pulse)
 *   • Integrated PLAY chip overlay (only on center cell hover)
 *   • Larger icon + name typography stack
 *
 * The DOM stays minimal so the existing 3D tilt + spotlight + visited
 * badge + affinity halo stack all compose without z-index conflicts.
 * All new visuals are layered above .colorBg and below .neonOutline
 * (which is the center-cell neon SVG outline).
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function GameContent() {
  const { data, isCenter } = useCellContext()
  // Per-project palette — used to tint the glow ring + halo.
  // Defaults to the gold token if data.color is missing.
  const palette = data.color || '#c9a227'

  return (
    <>
      {/* Hero halo — pulsating outer ring, center cell only.
          CSS handles the 2.4s ambient pulse + reduced-motion gate. */}
      {isCenter && (
        <div
          className={styles.heroHalo}
          style={{ ['--proj-glow' as string]: palette }}
          aria-hidden="true"
        />
      )}

      {/* Per-project glow ring around the icon — visible on every
          row, brighter on center. Uses the project's brand color. */}
      <div
        className={styles.heroIconRing}
        style={{ ['--proj-glow' as string]: palette }}
        aria-hidden="true"
      />

      <div className={styles.icon}>{data.ico}</div>
      <div className={styles.gameName}>{data.name}</div>
      {data.studio && <div className={styles.gameStudio}>{data.studio}</div>}

      {/* PLAY overlay — only on center cell. Click hits the cell's
          existing onGameCellClick which triggers payline takeover.
          Visually it's a hint chip, not a separate button — the
          whole cell stays clickable. */}
      {isCenter && (
        <div className={styles.heroPlayChip} aria-hidden="true">
          <span className={styles.heroPlayChipIcon}>▶</span>
          <span className={styles.heroPlayChipLabel}>EXPLORE</span>
        </div>
      )}
    </>
  )
}

export default GameContent
