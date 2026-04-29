/**
 * CellBackground — color base + shimmer sweep + cursor spotlight + neon
 * outline (when center) + visited badge (P0.2). Each layer is a
 * positioned absolute div with its own z-index.
 *
 * Visited badge: when the current center cell has been seen before
 * (visitCount > 1 in CellMemory), a small corner checkmark appears.
 * The check is read from CellMemory's mutable store and refreshed
 * via the `custom:cell:visited` event subscription so the badge
 * updates without re-rendering the entire reel grid.
 */

import { useEffect, useState } from 'react'
import styles from '../Cell.module.css'
import { useCellContext } from './CellContext'
import { useSlotStore } from '../../../store'
import { SECTIONS } from '../../../data'
import { bus, getCellMemory } from '../../../engine'

export function CellBackground() {
  const { data, isCenter } = useCellContext()
  const bgStyle = data.color ? { background: data.color } : {}

  // Visited state — only meaningful on the center cell (the row the
  // user is currently looking at). Read once on mount + on every
  // visit emission so the badge stays in sync without component-level
  // store subscriptions for every cell in the grid.
  const sectionIdx = useSlotStore((s) => s.currentSectionIdx)
  const itemIdx = useSlotStore((s) => s.currentItemIdx)
  const [visitCount, setVisitCount] = useState(0)

  useEffect(() => {
    if (!isCenter) return
    const secId = SECTIONS[sectionIdx]?.id
    if (!secId) return
    // Sync from store on mount + section/item change
    setVisitCount(getCellMemory(secId, itemIdx)?.visitCount ?? 0)
    // Subscribe to live visit events for this cell
    const off = bus.on('custom:cell:visited', (p) => {
      const payload = p as { cellKey: string; visitCount: number }
      if (payload.cellKey === `${secId}:${itemIdx}`) {
        setVisitCount(payload.visitCount)
      }
    })
    return off
  }, [isCenter, sectionIdx, itemIdx])

  // Show "returning visitor" badge after 2nd visit — first visit is the
  // user discovering it now, second is when they came back.
  const showVisited = isCenter && visitCount >= 2

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
      {/* Visited badge (P0.2) — gentle "you've been here" hint */}
      {showVisited && (
        <div
          className={styles.visitedBadge}
          aria-label={`Visited ${visitCount} times`}
          title={`Visited ${visitCount}×`}
        >
          ✓
        </div>
      )}
    </>
  )
}

export default CellBackground
