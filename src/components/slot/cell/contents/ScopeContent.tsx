/**
 * ScopeContent — 4 boolean badges for music / sfx / integration / qa.
 * Used by section 'projects' col 1.
 */

import styles from '../../Cell.module.css'
import { useCellContext } from '../CellContext'

const SCOPE_KEYS = [
  { key: 'music' as const,       label: 'MUSIC' },
  { key: 'sfx' as const,         label: 'SFX' },
  { key: 'integration' as const, label: 'INTEGR.' },
  { key: 'qa' as const,          label: 'QA' },
] as const

export function ScopeContent() {
  const { data } = useCellContext()
  if (!data.scope) return null
  return (
    <div className={styles.scopeBadges}>
      {SCOPE_KEYS.map(({ key, label }) => {
        const on = data.scope![key]
        return (
          <div
            key={key}
            className={`${styles.scopeBadge} ${on ? styles.scopeOn : styles.scopeOff}`}
          >
            <div className={styles.scopeDot} />
            {label}
          </div>
        )
      })}
    </div>
  )
}

export default ScopeContent
