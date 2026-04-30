/**
 * ScopeContent — deliverables checklist for each project.
 * Center cell: shows 4 items with neon cyan ON / dark OFF contrast.
 * Off-center: same layout, dimmer (inherited via .dim class on cell).
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

const SCOPE_KEYS = [
  { key: 'music' as const,       label: 'MUSIC',   icon: '♬' },
  { key: 'sfx' as const,         label: 'SFX',     icon: '⚡' },
  { key: 'integration' as const, label: 'INTEGR.', icon: '⬡' },
  { key: 'qa' as const,          label: 'QA',      icon: '✓' },
] as const

export function ScopeContent() {
  const { data, isCenter } = useCellContext()
  if (!data.scope) return null

  const activeCount = SCOPE_KEYS.filter(({ key }) => data.scope![key]).length

  return (
    <div className={styles.scopeBadges}>
      {isCenter && (
        <div className={styles.scopeHeader}>
          {activeCount}/{SCOPE_KEYS.length} DELIVERABLES
        </div>
      )}
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
