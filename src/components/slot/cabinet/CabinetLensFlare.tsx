/**
 * CabinetLensFlare — V4.1 anamorphic lens flare overlay.
 *
 * Hollywood / AAA games "lens flare" effect — a bright horizontal
 * streak with vertical light bloom that crosses the screen on
 * high-impact moments. Triggered by:
 *
 *   slot:reel:stop     (last reel only) → quick streak from L→R
 *   slot:win small     → blue streak
 *   slot:win medium    → cyan streak
 *   slot:win big       → magenta double-streak
 *   slot:win jackpot   → full anamorphic gold flare with halo
 *
 * Pure CSS overlay (z-index 8800, between anticipation 8500 and
 * win-fx 9000). Pointer-events:none — never blocks UI. Decays
 * automatically via CSS animation duration; component just toggles
 * the data-flare attribute.
 */

import { useEffect, useRef, useState } from 'react'
import { bus } from '../../../engine'
import styles from './CabinetLensFlare.module.css'

type FlareTier = 'reel' | 'small' | 'medium' | 'big' | 'jackpot'

const TIER_DURATIONS: Record<FlareTier, number> = {
  reel: 380,
  small: 600,
  medium: 700,
  big: 950,
  jackpot: 1400,
}

export function CabinetLensFlare() {
  const [tier, setTier] = useState<FlareTier | null>(null)
  const [key, setKey] = useState(0)
  const decayRef = useRef<number>(0)
  const lastReelStopCountRef = useRef(0)
  const lastSpinStartRef = useRef(0)

  useEffect(() => {
    const fire = (t: FlareTier) => {
      setTier(t)
      setKey((k) => k + 1)
      if (decayRef.current) window.clearTimeout(decayRef.current)
      decayRef.current = window.setTimeout(() => setTier(null), TIER_DURATIONS[t])
    }

    const offSpinStart = bus.on('slot:spin:start', () => {
      lastSpinStartRef.current = Date.now()
      lastReelStopCountRef.current = 0
    })

    const offReelStop = bus.on('slot:reel:stop', () => {
      lastReelStopCountRef.current += 1
      // Only flare on the final reel — every reel-stop would be noise
      if (lastReelStopCountRef.current >= 5) fire('reel')
    })

    const offWin = bus.on('slot:win', (p) => {
      const t = (p.type ?? 'small') as FlareTier
      fire(t)
    })

    return () => {
      offSpinStart()
      offReelStop()
      offWin()
      if (decayRef.current) window.clearTimeout(decayRef.current)
    }
  }, [])

  if (!tier) return null

  return (
    <div
      key={key}
      className={`${styles.flare} ${styles[`tier_${tier}`]}`}
      aria-hidden="true"
    >
      {/* Horizontal anamorphic streak — main flare element */}
      <div className={styles.streak} />
      {/* Vertical light bloom — hot spot in the center */}
      <div className={styles.bloom} />
      {/* Big/jackpot get a secondary parallel streak for depth */}
      {(tier === 'big' || tier === 'jackpot') && (
        <div className={`${styles.streak} ${styles.streakSecondary}`} />
      )}
      {/* Jackpot gets an extra radial sun-burst */}
      {tier === 'jackpot' && <div className={styles.sunburst} />}
    </div>
  )
}

export default CabinetLensFlare
