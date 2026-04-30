/**
 * CabinetWinFx — V3.6 cinematic win overlay.
 *
 * Listens for slot:win and renders a tier-scaled fullscreen overlay:
 *
 *   small    250ms centerline glow flash (already covered by reel
 *            internals — this overlay just paints a thin gold beam
 *            across the cabinet to reinforce the "where")
 *   medium   600ms cyan trail beam from L→R + 12 sparkles
 *   big      1200ms screen darken + horizontal scanline kick
 *            + 24 magenta particles bursting from center
 *   jackpot  2400ms full takeover — gold shower (~60 falling
 *            particles), chromatic split, central radial bloom,
 *            cabinet darkens to focus the moment
 *
 * Pure DOM/CSS — no canvas, no libraries. Particles are absolutely
 * positioned spans with --i index variables that drive trajectory.
 * All durations align with the side-rail win-phase decay so audio +
 * visuals + rails finish together.
 */

import { useEffect, useState } from 'react'
import { bus } from '../../../engine'
import styles from './CabinetWinFx.module.css'

type WinTier = 'small' | 'medium' | 'big' | 'jackpot'

interface ActiveWin {
  tier: WinTier
  amount: number
  /** monotonic key — re-mounts overlay on each win so animations restart */
  key: number
}

const TIER_HOLD_MS: Record<WinTier, number> = {
  small: 350,
  medium: 700,
  big: 1300,
  jackpot: 2500,
}

export function CabinetWinFx() {
  const [active, setActive] = useState<ActiveWin | null>(null)

  useEffect(() => {
    let timer = 0
    const off = bus.on('slot:win', (p) => {
      const tier = (p.type ?? 'small') as WinTier
      const amount = p.amount ?? 0
      setActive({ tier, amount, key: Date.now() })
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => setActive(null), TIER_HOLD_MS[tier])
    })
    return () => {
      off()
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  if (!active) return null

  return (
    <div
      key={active.key}
      className={`${styles.overlay} ${styles[`tier_${active.tier}`]}`}
      aria-hidden="true"
    >
      {/* Tier-specific layers */}
      {active.tier === 'small' && <SmallFx />}
      {active.tier === 'medium' && <MediumFx />}
      {active.tier === 'big' && <BigFx />}
      {active.tier === 'jackpot' && <JackpotFx />}

      {/* Universal — amount caption that flashes for big/jackpot */}
      {(active.tier === 'big' || active.tier === 'jackpot') && (
        <div className={styles.amount}>
          <span className={styles.amountTier}>
            {active.tier === 'jackpot' ? '★ JACKPOT ★' : 'BIG WIN'}
          </span>
          <span className={styles.amountValue}>
            ${active.amount.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Per-tier layer composition ────────────────────────────────────

function SmallFx() {
  return <div className={styles.lineSmall} />
}

function MediumFx() {
  return (
    <>
      <div className={styles.beamMedium} />
      <div className={styles.sparkField}>
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className={styles.spark}
            style={{ ['--i' as string]: i } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  )
}

function BigFx() {
  return (
    <>
      <div className={styles.darken} />
      <div className={styles.scanlineKick} />
      <div className={styles.particleBurst}>
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className={styles.burstParticle}
            style={{ ['--i' as string]: i } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  )
}

function JackpotFx() {
  return (
    <>
      <div className={styles.darkenJackpot} />
      <div className={styles.bloomCore} />
      <div className={styles.chromaSplit} />
      <div className={styles.goldShower}>
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className={styles.goldDrop}
            style={{ ['--i' as string]: i } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  )
}

export default CabinetWinFx
