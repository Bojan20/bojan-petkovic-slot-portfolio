import type { ReactNode } from 'react'
import styles from './Frame.module.css'

interface FrameProps {
  children: ReactNode
  isSpinning: boolean
  cellHeight?: number
}

export function Frame({ children, isSpinning, cellHeight = 0 }: FrameProps) {
  return (
    <div
      className={styles.frame}
      style={cellHeight > 0 ? { '--cell-h': `${cellHeight}px` } as React.CSSProperties : undefined}
    >
      {/* Left pillar */}
      <div className={`${styles.pillar} ${styles.left}`} />

      {/* Right pillar */}
      <div className={`${styles.pillar} ${styles.right}`} />

      {/* Corner medallions */}
      <div className={`${styles.medallion} ${styles.tl}`} />
      <div className={`${styles.medallion} ${styles.tr}`} />
      <div className={`${styles.medallion} ${styles.bl}`} />
      <div className={`${styles.medallion} ${styles.br}`} />

      {/* Top cold-light reflection strip */}
      <div className={styles.topStrip} />

      {/* Inner glow — activates during spin */}
      <div className={`${styles.innerGlow} ${isSpinning ? styles.innerGlowActive : ''}`} />

      {/* Content */}
      <div className={styles.content}>{children}</div>
    </div>
  )
}

export default Frame
