/**
 * Header — Top bar with name, credits, jackpot
 *
 * JetBrains Mono for numeric displays, Rajdhani for labels.
 */

import { memo } from 'react'
import styles from './Header.module.css'

interface HeaderProps {
  credits: number
  jackpot: number
}

const Header = memo(function Header({ credits, jackpot }: HeaderProps) {
  return (
    <header className={styles.header}>
      {/* Credits */}
      <div className={styles.display}>
        <span className={styles.label}>CREDITS</span>
        <span className={styles.value}>{credits.toLocaleString()}</span>
      </div>

      {/* Title */}
      <div className={styles.title}>
        <span className={styles.name}>BOJAN PETKOVIC</span>
        <span className={styles.subtitle}>Portfolio Machine</span>
      </div>

      {/* Jackpot */}
      <div className={styles.display}>
        <span className={styles.label}>JACKPOT</span>
        <span className={`${styles.value} ${styles.jackpot}`}>
          ${jackpot.toLocaleString()}
        </span>
      </div>
    </header>
  )
})

export default Header
