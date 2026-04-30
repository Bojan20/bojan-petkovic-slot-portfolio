/**
 * DetailContent — long-form description text (skills / about / career).
 *
 * Center: name (if present) → role/period (if present) → metric chips
 *   (if numbers found in text) → description paragraph.
 * Off-center: text only.
 *
 * Same metric-extraction logic as WorkContent. Kept as a separate
 * component so future variants (timeline card, link card) can fork
 * independently.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

function extractMetrics(text: string): string[] {
  const re = /(\d+\+?)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/g
  const hits: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null && hits.length < 3) {
    const unit = m[2]!.toUpperCase().split(' ')[0]!
    hits.push(`${m[1]} ${unit}`)
  }
  return hits
}

export function DetailContent() {
  const { data, isCenter } = useCellContext()
  const metrics = isCenter && data.text ? extractMetrics(data.text) : []

  return (
    <div className={styles.workLayout}>
      {isCenter && data.name && (
        <div className={styles.workTitle}>{data.name}</div>
      )}
      {isCenter && data.role && (
        <div className={styles.workRole}>{data.role}</div>
      )}
      {isCenter && metrics.length > 0 && (
        <div className={styles.metricsRow}>
          {metrics.map((m) => (
            <span key={m} className={styles.metricChip}>{m}</span>
          ))}
        </div>
      )}
      <div className={styles.workText}>{data.text}</div>
    </div>
  )
}

export default DetailContent
