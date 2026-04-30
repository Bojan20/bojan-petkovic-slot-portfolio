/**
 * CabinetAura — V8.0 audio-reactive backdrop bloom.
 *
 * Sits BEHIND the slot cabinet (z-index 0) — three radial spotlights
 * scaled + tinted by live FFT levels, plus a perspective grid floor
 * for depth. The DOM is paint-only — JS only writes three CSS custom
 * properties (--aura-bass / --aura-mid / --aura-treble) on the root
 * div; CSS does all the visual work.
 *
 * Cost: 1 RAF / frame, 3 setProperty calls. No React re-renders.
 *
 * Reduced motion: bypasses the RAF loop entirely; the CSS @media
 * rule freezes scale + transitions so the layer is a static gradient.
 *
 * Section + persona awareness: data-section / data-persona attrs
 * select per-context tint palettes from CSS, so the world subtly
 * shifts hue when the recruiter changes section or their persona is
 * inferred.
 */

import { useEffect, useRef } from 'react'
import { audioLevelsRef, bus } from '../../../engine'
import { useSlotStore } from '../../../store'
import { SECTIONS } from '../../../data'
import styles from './CabinetAura.module.css'

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function CabinetAura() {
  const rootRef = useRef<HTMLDivElement>(null)
  const sectionIdx = useSlotStore((s) => s.currentSectionIdx)

  // Reflect section into data attr so CSS palette flips
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const id = SECTIONS[sectionIdx]?.id ?? 'projects'
    el.setAttribute('data-section', id)
  }, [sectionIdx])

  // Persona inference subscriber — applies persona-tinted palette
  useEffect(() => {
    const off = bus.on('custom:persona:inferred', (p) => {
      const el = rootRef.current
      if (!el || !p?.persona) return
      el.setAttribute('data-persona', p.persona)
    })
    return off
  }, [])

  // RAF — read FFT, write CSS vars, no React reconciliation.
  useEffect(() => {
    if (REDUCED_MOTION) return
    const el = rootRef.current
    if (!el) return

    let raf = 0
    let prevBass = 0
    let prevMid = 0
    let prevTreble = 0

    const tick = () => {
      // Light EMA smoothing on top of AudioReactive's smoothing — keeps
      // the aura from twitching on stray transients while still feeling
      // alive on bass swells.
      const b = prevBass = prevBass * 0.62 + audioLevelsRef.bass * 0.38
      const m = prevMid = prevMid * 0.62 + audioLevelsRef.mid * 0.38
      const t = prevTreble = prevTreble * 0.55 + audioLevelsRef.treble * 0.45
      el.style.setProperty('--aura-bass', b.toFixed(3))
      el.style.setProperty('--aura-mid', m.toFixed(3))
      el.style.setProperty('--aura-treble', t.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={rootRef}
      className={styles.aura}
      aria-hidden="true"
      data-section="projects"
    >
      <div className={styles.auraGrid} />
      <div className={styles.auraBass} />
      <div className={styles.auraMid} />
      <div className={styles.auraTreble} />
    </div>
  )
}

export default CabinetAura
