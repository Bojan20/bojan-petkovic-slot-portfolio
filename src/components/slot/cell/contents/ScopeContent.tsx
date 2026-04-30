/**
 * ScopeContent — project deliverables (MUSIC / SFX / INTEGR. / QA).
 *
 * Center: conic-gradient completion ring (e.g. 3/4 = 270°) + full
 *   badge list with icon, dot, label, on/off neon.
 * Off-center: compact 2×2 icon grid — fast read, minimal space.
 *
 * The ring re-animates each time the cell lands in center position
 * (animation on `.scopeRing` fires from @keyframes on mount).
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

const SCOPE_KEYS = [
  { key: 'music'       as const, label: 'MUSIC',   icon: '♬' },
  { key: 'sfx'         as const, label: 'SFX',     icon: '⚡' },
  { key: 'integration' as const, label: 'INTEGR.', icon: '⬡' },
  { key: 'qa'          as const, label: 'QA',      icon: '✓' },
] as const

export function ScopeContent() {
  const { data, isCenter } = useCellContext()
  if (!data.scope) return null

  const activeCount = SCOPE_KEYS.filter(({ key }) => data.scope![key]).length

  /* Off-center: tight 2×2 icon grid */
  if (!isCenter) {
    return (
      <div className={styles.scopeCompact}>
        {SCOPE_KEYS.map(({ key, icon }) => {
          const on = data.scope![key]
          return (
            <div
              key={key}
              className={`${styles.scopeDot2} ${on ? styles.scopeDot2On : styles.scopeDot2Off}`}
            >
              {on ? icon : '·'}
            </div>
          )
        })}
      </div>
    )
  }

  /* Center: ring + badge list */
  const fillAngle = Math.round((activeCount / SCOPE_KEYS.length) * 360)

  return (
    <div className={styles.scopeBadges}>
      {/* Completion ring */}
      <div className={styles.scopeRingWrapper}>
        <div
          className={styles.scopeRing}
          style={{ ['--ring-fill' as string]: `${fillAngle}deg` }}
          aria-hidden="true"
        />
        <div className={styles.scopeRingInner}>
          <span className={styles.scopeRingCount}>{activeCount}</span>
          <span className={styles.scopeRingTotal}>/{SCOPE_KEYS.length}</span>
        </div>
      </div>

      {/* Counter header */}
      <div className={styles.scopeHeader}>
        {activeCount}/{SCOPE_KEYS.length} DELIVERED
      </div>

      {/* Badge list */}
      {SCOPE_KEYS.map(({ key, label, icon }) => {
        const on = data.scope![key]
        return (
          <div
            key={key}
            className={`${styles.scopeBadge} ${on ? styles.scopeOn : styles.scopeOff}`}
          >
            <span className={styles.scopeIcon}>{on ? icon : '·'}</span>
            <div className={styles.scopeDot} />
            {label}
          </div>
        )
      })}
    </div>
  )
}

export default ScopeContent
