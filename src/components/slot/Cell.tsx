import { useCallback } from 'react'
import type { CellData } from '../../types'
import styles from './Cell.module.css'

interface CellProps {
  data: CellData
  height: number
  onGameCellClick?: (itemIndex: number) => void
}

export function Cell({ data, height, onGameCellClick }: CellProps) {
  const isCenter = data.center
  const cls = [
    styles.cell,
    isCenter ? styles.center : styles.dim,
    data.type === 'game' ? styles.gameCell : '',
  ].filter(Boolean).join(' ')

  const handleClick = () => {
    if (data.type === 'game' && data.itemIndex !== undefined) {
      onGameCellClick?.(data.itemIndex)
    }
  }

  // 3D perspective tilt on hover — cursor position → rotateX/Y vars
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = ((e.clientX - rect.left) / rect.width - 0.5) * 2   // -1..+1
    const cy = ((e.clientY - rect.top) / rect.height - 0.5) * 2   // -1..+1
    e.currentTarget.style.setProperty('--cx', cx.toFixed(3))
    e.currentTarget.style.setProperty('--cy', cy.toFixed(3))
  }, [])

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--cx', '0')
    e.currentTarget.style.setProperty('--cy', '0')
  }, [])

  const bgStyle = data.color ? { background: data.color } : {}

  return (
    <div
      className={cls}
      style={{ height: `${height}px`, boxSizing: 'border-box' }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-cell-type={data.type}
      {...(isCenter ? { 'data-center-cell': '' } : {})}
    >
      {/* Ambient color layer */}
      <div className={styles.colorBg} style={bgStyle} />
      {/* Holographic shimmer sweep (activated on hover via CSS) */}
      <div className={styles.shimmer} aria-hidden />
      {/* Cursor spotlight — follows mouse position via --cx/--cy */}
      <div className={styles.spotlight} aria-hidden />
      {/* Neon animated outline SVG (shown on center winning cell) */}
      {isCenter && (
        <svg className={styles.neonOutline} aria-hidden>
          <rect x="1.5" y="1.5" width="calc(100% - 3px)" height="calc(100% - 3px)" rx="4" ry="4" />
        </svg>
      )}

      {data.type === 'game' && (
        <>
          <div className={styles.icon}>{data.ico}</div>
          <div className={styles.gameName}>{data.name}</div>
          {data.studio && <div className={styles.gameStudio}>{data.studio}</div>}
        </>
      )}

      {data.type === 'scope' && data.scope && (
        <div className={styles.scopeBadges}>
          {(
            [
              { key: 'music' as const, label: 'MUSIC' },
              { key: 'sfx' as const, label: 'SFX' },
              { key: 'integration' as const, label: 'INTEGR.' },
              { key: 'qa' as const, label: 'QA' },
            ] as const
          ).map(({ key, label }) => {
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
      )}

      {data.type === 'work' && (
        <div className={styles.workText}>{data.text}</div>
      )}

      {data.type === 'tools' && data.tools && (
        <div className={styles.toolsGrid}>
          {data.tools.map((t) => (
            <div key={t} className={styles.toolBadge}>
              {t}
            </div>
          ))}
        </div>
      )}

      {data.type === 'demo' && (
        <div className={styles.demoCell}>
          <div className={styles.demoBtn}>
            <div className={styles.demoTri} />
          </div>
          <div className={styles.demoWave}>
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className={styles.demoBar}
                style={{
                  height: `${3 + Math.sin(i * 1.4) * 7}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <div className={styles.demoLabel}>
            {data.demo === 'video' ? '▶ VIDEO' : '▶ LISTEN'}
          </div>
        </div>
      )}

      {/* simple = icon + name (+ period) — col 0 for skills/about/career/contact */}
      {data.type === 'simple' && (
        <>
          <div className={styles.icon}>{data.ico}</div>
          <div className={styles.gameName}>{data.name}</div>
          {(data.studio || data.period) && (
            <div className={styles.gameStudio}>{data.studio || data.period}</div>
          )}
        </>
      )}

      {/* detail = description text — col 1 for skills/about/career/contact */}
      {data.type === 'detail' && (
        <div className={styles.workText}>{data.text}</div>
      )}
    </div>
  )
}

export default Cell
