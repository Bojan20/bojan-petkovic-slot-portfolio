/**
 * ToolsContent — grid of tool/skill badges.
 * Used by 'tools' cell type across most sections.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function ToolsContent() {
  const { data } = useCellContext()
  if (!data.tools) return null
  return (
    <div className={styles.toolsGrid}>
      {data.tools.map((t) => (
        <div key={t} className={styles.toolBadge}>{t}</div>
      ))}
    </div>
  )
}

export default ToolsContent
