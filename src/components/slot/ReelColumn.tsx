import { forwardRef } from 'react'
import type { CellData } from '../../types'
import { Cell } from './Cell'
import styles from './ReelColumn.module.css'

interface ReelColumnProps {
  cells: CellData[]  // 7 cells (3 visible + buffer)
  colIndex: number
  cellHeight: number
  stripTop: number   // passed from SlotMachine — positions cell[3] at zone center
  isGameReel?: boolean
  spinClass?: string
  centerWin?: boolean
  onGameCellClick?: (itemIndex: number) => void
}

// Ref points to the outer column div
export const ReelColumn = forwardRef<HTMLDivElement, ReelColumnProps>(
  function ReelColumn({ cells, colIndex, cellHeight, stripTop, isGameReel, spinClass, centerWin, onGameCellClick }, ref) {
    const columnCls = [
      styles.column,
      isGameReel ? styles.gameReel : '',
      spinClass || '',
      centerWin ? styles.centerWin : '',
    ].filter(Boolean).join(' ')

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
