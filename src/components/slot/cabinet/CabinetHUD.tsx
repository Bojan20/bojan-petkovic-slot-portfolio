/**
 * CabinetHUD — info strip below the marquee (V3.0 Foundation).
 *
 * Live HUD that reflects engine state in real time:
 *   SECTION   — current top-level tab (WORK / SKILLS / ABOUT / CAREER / REACH)
 *   VISITED   — N / total cells visited this session (CellMemory)
 *   STREAK    — consecutive non-current spins (combo)
 *   JACKPOT   — live jackpot ticker
 *   PERSONA   — current PersonaInference label (debug-aware)
 *
 * Subscribes to bus events for streak / jackpot / persona updates.
 * Section + visited come straight from store/CellMemory.
 */

import { useEffect, useRef, useState } from 'react'
import { bus, getCurrentPersona, getVisitedKeys, type Persona } from '../../../engine'
import { useSlotStore } from '../../../store'
import { SECTIONS } from '../../../data'
import styles from './CabinetHUD.module.css'

export function CabinetHUD() {
  const { currentSectionIdx, jackpot } = useSlotStore()
  const [streak, setStreak] = useState(0)
  const [persona, setPersona] = useState<Persona>('balanced')
  const [visitedCount, setVisitedCount] = useState(0)
  // V3.4 — animated jackpot. We display a tween value and lerp it
  // toward the real jackpot whenever it changes, so the number ticks
  // smoothly upward instead of jumping integer-by-integer.
  const [displayJackpot, setDisplayJackpot] = useState(jackpot)
  // V3.4 — jackpot just-bumped flash flag for a quick CSS pulse
  const [jpFlash, setJpFlash] = useState(0)
  const jpRafRef = useRef<number>(0)

  // Streak — increments on every spin start, resets on win
  useEffect(() => {
    const offSpin = bus.on('slot:spin:start', () => setStreak((s) => s + 1))
    const offWin = bus.on('slot:win', () => setStreak(0))
    return () => { offSpin(); offWin() }
  }, [])

  // Persona inference updates
  useEffect(() => {
    const off = bus.on('custom:persona:inferred', (p) => {
      setPersona(p.persona as Persona)
    })
    setPersona(getCurrentPersona())
    return off
  }, [])

  // Visited count — recompute on every cell visit
  useEffect(() => {
    const off = bus.on('custom:cell:visited', () => {
      setVisitedCount(getVisitedKeys().length)
    })
    setVisitedCount(getVisitedKeys().length)
    return off
  }, [])

  // V3.4 — jackpot tween. Whenever the real jackpot changes, lerp
  // displayJackpot toward it over ~600ms via RAF. Avoids the jarring
  // integer step that the V1 ticker had.
  useEffect(() => {
    if (jpRafRef.current) cancelAnimationFrame(jpRafRef.current)
    const start = displayJackpot
    const target = jackpot
    if (start === target) return
    const t0 = performance.now()
    const dur = 600
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.round(start + (target - start) * eased)
      setDisplayJackpot(next)
      if (t < 1) jpRafRef.current = requestAnimationFrame(tick)
    }
    jpRafRef.current = requestAnimationFrame(tick)
    setJpFlash((f) => f + 1)  // trigger keyed flash class
    return () => { if (jpRafRef.current) cancelAnimationFrame(jpRafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jackpot])

  const sectionName = SECTIONS[currentSectionIdx]?.label ?? 'WORK'

  return (
    <div className={styles.hud} aria-label="Cabinet info HUD">
      {/* V3.4 — section item with online status dot */}
      <div className={styles.item}>
        <span className={styles.label}>SECTION</span>
        <span className={styles.value}>
          <span className={styles.statusDot} aria-hidden="true" />
          {sectionName}
        </span>
      </div>
      <Sep />
      <Item label="VISITED" value={<>{visitedCount}<small>/24</small></>} />
      <Sep />
      <Item
        label="STREAK"
        value={`×${streak}`}
        glow={streak > 0 ? 'cyan' : undefined}
      />
      <Sep />
      {/* V3.4 — jackpot ticker with smooth tween + flash on change */}
      <div className={styles.item} key={`jp-${jpFlash}`}>
        <span className={styles.label}>JACKPOT</span>
        <span className={`${styles.value} ${styles.jackpotFlash}`} data-glow="gold">
          ${displayJackpot.toLocaleString()}
        </span>
      </div>
      <Sep />
      <Item label="PERSONA" value={persona.replace(/_/g, ' ').toUpperCase()} compact />
    </div>
  )
}

function Item(props: {
  label: string
  value: React.ReactNode
  glow?: 'cyan' | 'gold'
  compact?: boolean
}) {
  return (
    <div className={`${styles.item} ${props.compact ? styles.itemCompact : ''}`}>
      <span className={styles.label}>{props.label}</span>
      <span
        className={styles.value}
        data-glow={props.glow}
      >
        {props.value}
      </span>
    </div>
  )
}

function Sep() {
  return <div className={styles.sep} aria-hidden="true" />
}

export default CabinetHUD
