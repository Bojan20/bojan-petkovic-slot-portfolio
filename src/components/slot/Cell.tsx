/**
 * Cell — Single reel cell (WoO style)
 *
 * Gold border, dark interior, tool badges, scope indicator.
 * Center row cells get enhanced glow + sparkle.
 */

import { memo } from 'react'
import type { ReelCell } from '../../types'
import styles from './Cell.module.css'

interface CellProps {
  cell: ReelCell
  isCenter: boolean
  onClick?: () => void
}

const Cell = memo(function Cell({ cell, isCenter, onClick }: CellProps) {
  return (
    <div
      className={`${styles.cell} ${isCenter ? styles.center : styles.dim}`}
      onClick={isCenter && cell.hasDemo ? onClick : undefined}
      role={isCenter && cell.hasDemo ? 'button' : undefined}
      tabIndex={isCenter && cell.hasDemo ? 0 : undefined}
      aria-label={isCenter ? `${cell.title} — ${cell.role}` : undefined}
    >
      {/* Icon */}
      <span className={styles.icon}>{cell.icon}</span>

      {/* Title */}
      <span className={styles.title}>{cell.title}</span>

      {/* Role/Studio */}
      <span className={styles.role}>{cell.role}</span>

      {/* Tags */}
      <div className={styles.tags}>
        {cell.tags.slice(0, 3).map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
          </span>
        ))}
      </div>

      {/* Demo indicator */}
      {cell.hasDemo && (
        <span className={styles.demo}>
          {isCenter ? '▶ PLAY' : '▶'}
        </span>
      )}

      {/* Center sparkle corners */}
      {isCenter && (
        <>
          <span className={`${styles.sparkle} ${styles.tl}`} />
          <span className={`${styles.sparkle} ${styles.tr}`} />
          <span className={`${styles.sparkle} ${styles.bl}`} />
          <span className={`${styles.sparkle} ${styles.br}`} />
        </>
      )}
    </div>
  )
})

export default Cell
