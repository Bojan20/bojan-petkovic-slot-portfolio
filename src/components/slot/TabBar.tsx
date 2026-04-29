import { forwardRef } from 'react'
import type { SectionDef } from '../../types'
import styles from './TabBar.module.css'

interface TabBarProps {
  sections: SectionDef[]
  activeSectionIdx: number
  onChange: (idx: number) => void
  disabled: boolean
}

/**
 * KineticLabel (P3.4) — letter-by-letter cascade reveal.
 *
 * Each character renders as a span with --i (index) custom property
 * so CSS can stagger animation-delay. When the active class flips on
 * via parent re-render, every char re-runs the keyframe with its own
 * delay, producing a quick wave across the label. ~22ms/char × 7-8
 * chars = ~150-180ms total, fast enough to feel responsive but slow
 * enough to read as motion.
 *
 * The `key={label}` on the wrapper forces a fresh React mount when
 * the active section changes, so the animation always re-runs (CSS
 * animations don't restart on the same DOM node without a remount or
 * a class toggle trick).
 */
function KineticLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`${styles.tabLabel} ${active ? styles.tabLabelKinetic : ''}`}
      // key on the wrapper would re-mount only on label-string change,
      // not on active change. Active toggle is handled via the
      // `tabLabelKinetic` class which itself re-applies the animation.
      aria-label={label}
    >
      {[...label].map((ch, i) => (
        <span
          key={i}
          className={styles.tabChar}
          style={{ ['--i' as string]: i }}
          aria-hidden="true"
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}

export const TabBar = forwardRef<HTMLDivElement, TabBarProps>(function TabBar(
  { sections, activeSectionIdx, onChange, disabled },
  ref,
) {
  return (
    <div ref={ref} className={styles.tabs} role="tablist">
      {sections.map((section, i) => {
        const isActive = i === activeSectionIdx
        return (
          <button
            key={section.id}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => !disabled && onChange(i)}
            disabled={disabled}
            role="tab"
            aria-selected={isActive}
          >
            <span className={styles.tabIcon}>{section.icon}</span>
            <KineticLabel label={section.label} active={isActive} />
          </button>
        )
      })}
    </div>
  )
})

export default TabBar
