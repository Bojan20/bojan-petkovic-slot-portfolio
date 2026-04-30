/**
 * GameContent — Hero project tile.
 *
 * Center cell: per-project palette halo + pulsing icon ring +
 * gradient display-size name + EXPLORE chip + rank badge "02".
 * Off-center: smaller emoji + name + studio — same hierarchy,
 * scaled down by parent .dim class.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function GameContent() {
  const { data, isCenter } = useCellContext()
  const palette = data.color || '#c9a227'

  // "02" rank badge — 1-indexed, zero-padded to 2 chars
  const rank = data.itemIndex !== undefined
    ? String(data.itemIndex + 1).padStart(2, '0')
    : null

  return (
    <>
      {/* Hero halo — ambient outer pulse, center only */}
      {isCenter && (
        <div
          className={styles.heroHalo}
          style={{ ['--proj-glow' as string]: palette }}
          aria-hidden="true"
        />
      )}

      {/* Project rank — "01" – "08" top-right corner, center only */}
      {isCenter && rank && (
        <div className={styles.gameRank} aria-hidden="true">
          {rank}
        </div>
      )}

      {/* Glow ring around icon — all rows, brighter on center */}
      <div
        className={styles.heroIconRing}
        style={{ ['--proj-glow' as string]: palette }}
        aria-hidden="true"
      />

      {/* Icon — center uses .iconCenter for size + drop-shadow boost */}
      <div className={`${styles.icon} ${isCenter ? styles.iconCenter : ''}`}>
        {data.ico}
      </div>

      <div className={styles.gameName}>{data.name}</div>
      {data.studio && <div className={styles.gameStudio}>{data.studio}</div>}

      {/* EXPLORE chip — pointer hint for center; entire cell is clickable */}
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
