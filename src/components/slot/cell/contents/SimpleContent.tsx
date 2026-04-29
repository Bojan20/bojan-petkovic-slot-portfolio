/**
 * SimpleContent — icon + name (+ studio | period). Used by skills /
 * about / career / contact section col 0.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function SimpleContent() {
  const { data } = useCellContext()
  return (
    <>
      <div className={styles.icon}>{data.ico}</div>
      <div className={styles.gameName}>{data.name}</div>
      {(data.studio || data.period) && (
        <div className={styles.gameStudio}>{data.studio || data.period}</div>
      )}
    </>
  )
}

export default SimpleContent
