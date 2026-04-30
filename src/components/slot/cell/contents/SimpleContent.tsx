/**
 * SimpleContent — icon + name cell for col-0 of skills / about /
 * career / contact sections.
 *
 * Center cell shows enriched layout:
 *   • Larger icon (iconCenter class for size + drop-shadow boost)
 *   • Period label (career dates, contact type, location, etc.)
 *   • Level badge (EXPERT / ADVANCED) — skills section
 *   • Domain badge (COMPOSITION / ENGINEERING / etc.) — skills
 *   • Highlights grid (stat chips) — about / career sections
 *
 * All enrichment is optional — fields that don't exist for a given
 * section simply don't render. No section-specific branching needed.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

export function SimpleContent() {
  const { data, isCenter } = useCellContext()

  // level / domain come through as tools[] with 1 element each
  // (set by skills.ts section strategy)
  const level  = data.level  ?? (data.tools?.length === 1 && ['EXPERT', 'ADVANCED', 'PROFICIENT'].includes(data.tools[0] ?? '') ? data.tools[0] : null)
  const domain = data.domain ?? null

  return (
    <>
      <div className={`${styles.icon} ${isCenter ? styles.iconCenter : ''}`}>
        {data.ico}
      </div>

      <div className={styles.gameName}>{data.name}</div>

      {(data.studio || data.period) && (
        <div className={styles.simplePeriod}>
          {data.studio || data.period}
        </div>
      )}

      {/* EXPERT / ADVANCED badge — skills section center */}
      {isCenter && level && (
        <div className={`${styles.levelBadge} ${level === 'EXPERT' ? styles.levelExpert : styles.levelAdvanced}`}>
          {level}
        </div>
      )}

      {/* Domain badge — COMPOSITION / ENGINEERING / etc. */}
      {isCenter && domain && (
        <div className={styles.domainBadge}>{domain}</div>
      )}

      {/* Highlight chips — about / career sections pass these via
          the highlights array in SimpleItem (→ data.highlights) */}
      {isCenter && data.highlights && data.highlights.length > 0 && (
        <div className={styles.highlightGrid}>
          {data.highlights.slice(0, 4).map((h, i) => (
            <div key={i} className={styles.highlightChip}>{h}</div>
          ))}
        </div>
      )}
    </>
  )
}

export default SimpleContent
