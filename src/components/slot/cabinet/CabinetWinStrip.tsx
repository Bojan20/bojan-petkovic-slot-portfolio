/**
 * CabinetWinStrip — gameplay HUD between reel zone and control deck.
 *
 * Holds the LAST WIN amount + COMBO meter. Both are reactive:
 *   • LAST WIN — set by slot:win bus event, persists until next win
 *   • COMBO    — bumps on consecutive wins within 8s, decays on miss
 *
 * Empty state (zero wins yet) shows "—" so the strip never feels
 * orphaned. Enters with a quick scale-flash on each new win.
 */

import { useEffect, useState } from 'react'
import { bus } from '../../../engine'
import styles from './CabinetWinStrip.module.css'

type WinTier = 'small' | 'medium' | 'big' | 'jackpot'

const COMBO_WINDOW_MS = 8000

export function CabinetWinStrip() {
  const [lastWin, setLastWin] = useState<{ amount: number; tier: WinTier } | null>(null)
  const [combo, setCombo] = useState(0)
  const [flashKey, setFlashKey] = useState(0)

  useEffect(() => {
    let comboTimer = 0
    const off = bus.on('slot:win', (p) => {
      setLastWin({ amount: p.amount ?? 0, tier: (p.type ?? 'small') as WinTier })
      setCombo((c) => c + 1)
      setFlashKey((k) => k + 1)
      if (comboTimer) window.clearTimeout(comboTimer)
      comboTimer = window.setTimeout(() => setCombo(0), COMBO_WINDOW_MS)
    })
    return () => {
      off()
      if (comboTimer) window.clearTimeout(comboTimer)
    }
  }, [])

  return (
    <div className={styles.strip}>
      <div className={styles.meter} key={`win-${flashKey}`}>
        <span className={styles.label}>LAST WIN</span>
        <span className={styles.value}>
          {lastWin ? `$${lastWin.amount.toLocaleString()}` : '—'}
        </span>
        {lastWin && (
          <span className={styles.chip} data-tier={lastWin.tier}>
            {lastWin.tier.toUpperCase()}
          </span>
        )}
      </div>

      <div className={styles.spark} aria-hidden="true" />

      <div className={styles.meter}>
        <span className={styles.label}>COMBO</span>
        <span className={styles.value}>×{combo}</span>
        {combo > 1 && (
          <span className={styles.chip} data-tier="streak">STREAK</span>
        )}
      </div>
    </div>
  )
}

export default CabinetWinStrip
