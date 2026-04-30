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
  const { data, isCenter } = useCellContext()
  return (
    <div className={styles.workLayout}>
      {isCenter && data.name && (
        <div className={styles.workTitle}>{data.name}</div>
      )}
      {isCenter && data.role && (
        <div className={styles.workRole}>{data.role}</div>
      )}
      <div className={styles.workText}>{data.text}</div>
    </div>
  )
}

export default DetailContent
