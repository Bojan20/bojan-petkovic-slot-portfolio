/**
 * CabinetSideRails — LED chase rails (V3.0 Foundation, V3.3 reactive).
 *
 * V3.3 makes the rails reactive to slot engine state:
 *   • idle      → 3.4s slow chase (calm)
 *   • spinning  → 0.9s fast chase + brighter glow (urgent)
 *   • landing   → quick reverse-chase flash on each reel stop
 *   • win       → sustained per-tier flash (gold burst on jackpot)
 *
 * Subscribes to the EventBus directly so SlotMachine doesn't need
 * to wire the prop through. Phase is held in local state with the
 * default decaying back to "idle" after each transient effect.
 */

import { useEffect, useRef, useState } from 'react'
import { bus } from '../../../engine'
import styles from './CabinetSideRails.module.css'

type RailPhase = 'idle' | 'spinning' | 'landing' | 'win-small' | 'win-medium' | 'win-big' | 'win-jackpot'

export function CabinetSideRails() {
  const [phase, setPhase] = useState<RailPhase>('idle')
  const decayTimerRef = useRef<number>(0)

  useEffect(() => {
    const clearDecay = () => {
      if (decayTimerRef.current) {
        window.clearTimeout(decayTimerRef.current)
        decayTimerRef.current = 0
      }
    }
    const decayTo = (target: RailPhase, ms: number) => {
      clearDecay()
      decayTimerRef.current = window.setTimeout(() => setPhase(target), ms)
    }

    const offSpin = bus.on('slot:spin:start', () => {
      clearDecay()
      setPhase('spinning')
    })
    const offReelStop = bus.on('slot:reel:stop', () => {
      // Quick reverse-chase flash on each reel landing — overrides
      // current phase for 220ms then restores spinning/idle.
      setPhase('landing')
      decayTo('spinning', 220)
    })
    const offWin = bus.on('slot:win', (p) => {
      clearDecay()
      const tier = (p.type ?? 'small') as 'small' | 'medium' | 'big' | 'jackpot'
      setPhase(`win-${tier}` as RailPhase)
      // Hold the win pulse for tier-scaled duration, then back to idle
      const hold = tier === 'jackpot' ? 2400 : tier === 'big' ? 1400 : tier === 'medium' ? 900 : 600
      decayTo('idle', hold)
    })

    return () => {
      offSpin()
      offReelStop()
      offWin()
      clearDecay()
    }
  }, [])

  return (
    <>
      <div
        className={`${styles.rail} ${styles.railLeft}`}
        data-phase={phase}
        aria-hidden="true"
      >
        <div className={styles.chase} />
      </div>
      <div
        className={`${styles.rail} ${styles.railRight}`}
        data-phase={phase}
        aria-hidden="true"
      >
        <div className={styles.chase} />
      </div>
    </>
  )
}

export default CabinetSideRails
