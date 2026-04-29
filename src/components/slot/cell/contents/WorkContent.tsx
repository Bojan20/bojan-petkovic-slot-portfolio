/**
 * WorkContent — long descriptive text. Used by 'work' cell type.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function WorkContent() {
  const { data } = useCellContext()
  return <div className={styles.workText}>{data.text}</div>
}

export default WorkContent
