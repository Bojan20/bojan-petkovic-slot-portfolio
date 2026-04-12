/**
 * TabBar — Category filter tabs
 *
 * Gold active state, WoO style inactive tabs.
 */

import { memo } from 'react'
import type { PortfolioCategory, TabDef } from '../../types'
import styles from './TabBar.module.css'

interface TabBarProps {
  tabs: TabDef[]
  activeTab: PortfolioCategory
  onTabChange: (tab: PortfolioCategory) => void
  disabled?: boolean
}

const TabBar = memo(function TabBar({
  tabs,
  activeTab,
  onTabChange,
  disabled,
}: TabBarProps) {
  return (
    <nav className={styles.tabBar} role="tablist" aria-label="Portfolio categories">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
          disabled={disabled}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
})

export default TabBar
