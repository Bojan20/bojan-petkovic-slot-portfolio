/**
 * WorkContent — company/role/description stack (work cell type).
 * Center cell shows full hierarchy: name → role → text.
 * Off-center shows only the text snippet (space-constrained).
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function WorkContent() {
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

export default WorkContent
