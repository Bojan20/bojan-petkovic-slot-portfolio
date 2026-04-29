/**
 * DetailContent — long-form description text. Used by 'detail' cell
 * type for skills / about / career / contact col 1+.
 *
 * Same render shape as WorkContent but kept distinct so future
 * detail variants (timeline, link card) can fork off this component
 * without affecting the projects-section work text.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function DetailContent() {
  const { data } = useCellContext()
  return <div className={styles.workText}>{data.text}</div>
}

export default DetailContent
