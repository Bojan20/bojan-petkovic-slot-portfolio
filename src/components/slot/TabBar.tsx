import { forwardRef } from 'react'
import type { SectionDef } from '../../types'
import styles from './TabBar.module.css'

interface TabBarProps {
  sections: SectionDef[]
  activeSectionIdx: number
  onChange: (idx: number) => void
  disabled: boolean
}

export const TabBar = forwardRef<HTMLDivElement, TabBarProps>(function TabBar(
  { sections, activeSectionIdx, onChange, disabled },
  ref,
) {
  return (
    <div ref={ref} className={styles.tabs} role="tablist">
      {sections.map((section, i) => (
        <button
          key={section.id}
          className={`${styles.tab} ${i === activeSectionIdx ? styles.active : ''}`}
          onClick={() => !disabled && onChange(i)}
          disabled={disabled}
          role="tab"
          aria-selected={i === activeSectionIdx}
        >
          <span className={styles.tabIcon}>{section.icon}</span>
          <span className={styles.tabLabel}>{section.label}</span>
        </button>
      ))}
    </div>
  )
})

export default TabBar
