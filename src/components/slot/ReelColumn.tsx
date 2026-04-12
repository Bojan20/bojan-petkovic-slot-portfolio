import { forwardRef } from 'react'
import type { CellData } from '../../types'
import { Cell } from './Cell'
import styles from './ReelColumn.module.css'

interface ReelColumnProps {
  cells: CellData[]  // 7 cells (3 visible + buffer)
  colIndex: number
  cellHeight: number
  isGameReel?: boolean
  spinClass?: string
  onGameCellClick?: (itemIndex: number) => void
}

// Ref points to the outer column div
export const ReelColumn = forwardRef<HTMLDivElement, ReelColumnProps>(
  function ReelColumn({ cells, colIndex, cellHeight, isGameReel, spinClass, onGameCellClick }, ref) {
    const columnCls = [
      styles.column,
      isGameReel ? styles.gameReel : '',
      spinClass || '',
    ].filter(Boolean).join(' ')

    // Strip top offset: center row (index 3 of 7) sits in the visible middle
    const stripTop = -(cellHeight * 2 + 6 * 2)

    return (
      <div ref={ref} className={columnCls} data-col={colIndex}>
        <div
          className={styles.strip}
          data-strip="true"
          style={{ top: `${stripTop}px` }}
        >
          {cells.map((cell, rowIndex) => (
            <Cell
              key={`${colIndex}-${rowIndex}`}
              data={cell}
              height={cellHeight}
              onGameCellClick={onGameCellClick}
            />
          ))}
        </div>
      </div>
    )
  }
)

export default ReelColumn
