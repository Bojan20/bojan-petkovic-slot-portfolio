/**
 * CabinetWorld — V3.7 background world (3-layer parallax).
 *
 * Lives BEHIND the slot machine. Three CSS-only layers compose a
 * "the cabinet floats inside a cyberpunk world" feel without any
 * canvas or shader work:
 *
 *   far  — slow nebula clouds (radial gradients, 38s drift)
 *   mid  — subtle grid pattern, medium speed scroll
 *   near — sparkle field reactive to spin (faster scroll while
 *          spinning, calm while idle)
 *
 * Layers are all position:fixed so they live behind position:relative
 * cabinet and don't affect layout. pointer-events:none throughout —
 * the world is wallpaper, not interactive.
 */

import { useEffect, useState } from 'react'
import { bus } from '../../../engine'
import styles from './CabinetWorld.module.css'

export function CabinetWorld() {
  const [phase, setPhase] = useState<'idle' | 'spinning'>('idle')

  useEffect(() => {
    const offSpin = bus.on('slot:spin:start', () => setPhase('spinning'))
    const offWin = bus.on('slot:win', () => setPhase('idle'))
    // Decay back to idle ~3s after spin start in case no win fires
    let t = 0
    const offSpinStart = bus.on('slot:spin:start', () => {
      if (t) window.clearTimeout(t)
      t = window.setTimeout(() => setPhase('idle'), 3500)
    })
    return () => {
      offSpin()
      offWin()
      offSpinStart()
      if (t) window.clearTimeout(t)
    }
  }, [])

  return (
    <>
      <div className={styles.far} aria-hidden="true" />
      <div className={styles.mid} aria-hidden="true" />
      <div
        className={`${styles.near} ${phase === 'spinning' ? styles.nearSpin : ''}`}
        aria-hidden="true"
      />
    </>
  )
}

export default CabinetWorld
