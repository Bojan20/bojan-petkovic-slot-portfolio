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

import { useEffect, useState } from 'react'
import { bus, getCurrentPersona, getVisitedKeys, type Persona } from '../../../engine'
import { useSlotStore } from '../../../store'
import { SECTIONS } from '../../../data'
import styles from './CabinetHUD.module.css'

export function CabinetHUD() {
  const { currentSectionIdx, jackpot } = useSlotStore()
  const [streak, setStreak] = useState(0)
  const [persona, setPersona] = useState<Persona>('balanced')
  const [visitedCount, setVisitedCount] = useState(0)

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
    // initial pull
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

  const sectionName = SECTIONS[currentSectionIdx]?.label ?? 'WORK'

  return (
    <div className={styles.hud} aria-label="Cabinet info HUD">
      <Item label="SECTION" value={sectionName} />
      <Sep />
      <Item label="VISITED" value={<>{visitedCount}<small>/24</small></>} />
      <Sep />
      <Item label="STREAK" value={`×${streak}`} glow={streak > 0 ? 'cyan' : undefined} />
      <Sep />
      <Item label="JACKPOT" value={`$${jackpot.toLocaleString()}`} glow="gold" />
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
