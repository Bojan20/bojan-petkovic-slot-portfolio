/**
 * ReelColumn — Single vertical reel strip
 *
 * Contains 3 visible cells (top, center, bottom).
 * Wraps in a container that GSAP animates on Y axis during spin.
 */

import { forwardRef, memo } from 'react'
import type { ReelCell } from '../../types'
import Cell from './Cell'
import styles from './ReelColumn.module.css'

interface ReelColumnProps {
  cells: ReelCell[]
  columnIndex: number
  onCellClick?: (cell: ReelCell) => void
}

const ReelColumn = memo(
  forwardRef<HTMLDivElement, ReelColumnProps>(function ReelColumn(
    { cells, columnIndex, onCellClick },
    ref
  ) {
    return (
      <div className={styles.column} data-col={columnIndex}>
        <div className={styles.strip} ref={ref}>
          {cells.map((cell, rowIndex) => (
            <Cell
              key={`${columnIndex}-${rowIndex}`}
              cell={cell}
              isCenter={rowIndex === 1} // Middle row = center
              onClick={() => onCellClick?.(cell)}
            />
          ))}
        </div>
      </div>
    )
  })
)

export default ReelColumn
