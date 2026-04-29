/**
 * GameContent — project tile (icon + name + studio).
 * Used by section 'projects' col 0 (the project chooser).
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function GameContent() {
  const { data } = useCellContext()
  return (
    <>
      <div className={styles.icon}>{data.ico}</div>
      <div className={styles.gameName}>{data.name}</div>
      {data.studio && <div className={styles.gameStudio}>{data.studio}</div>}
    </>
  )
}

export default GameContent
