/**
 * WorkContent — project description with auto-extracted metrics.
 *
 * Center: name → role → METRIC chips (extracted via regex from text)
 *   → full description paragraph. Recruiters see numbers first.
 * Off-center: text only (space-constrained).
 *
 * Metric extraction: finds patterns like "200+", "4 layers", "3 titles"
 * and renders them as gold chips — quick scannable proof of output.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

/** Pull numeric + unit combos from free text. Returns max 3 chips. */
function extractMetrics(text: string): string[] {
  // Match patterns: "200+ SFX", "4 adaptive", "10+ titles", "3-note"
  const re = /(\d+\+?)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/g
  const hits: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null && hits.length < 3) {
    const unit = m[2]!.toUpperCase().split(' ')[0]!
    hits.push(`${m[1]} ${unit}`)
  }
  return hits
}

export function WorkContent() {
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

export default WorkContent
