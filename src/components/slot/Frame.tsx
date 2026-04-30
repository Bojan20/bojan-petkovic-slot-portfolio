/**
 * Frame — V3 cabinet bezel around the reel zone.
 *
 * V3 redesign (2026-04-30): pillars + 4 medallions REPLACED by
 * holographic chromatic edge + thin LED side rails. The frame is now
 * "stage", not "ornament" — it provides the rectangular boundary,
 * a subtle holo-glow edge, an inner glow that fires during spin,
 * and the reel-win ripple animation. Side rails live in
 * `cabinet/CabinetSideRails` and overlay the reel zone edges.
 *
 * Win ripple (P1.11) preserved — the cabinet still "rings like a bell"
 * on jackpot/big wins. Vertigo push on jackpot still drops body
 * data-jackpot attr so the global lens push fires.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Frame.module.css'
import { bus } from '../../engine'
import { CabinetSideRails } from './cabinet'

interface FrameProps {
  children: ReactNode
  isSpinning: boolean
  cellHeight?: number
}

export function Frame({ children, isSpinning, cellHeight = 0 }: FrameProps) {
  const frameRef = useRef<HTMLDivElement>(null)

  // P1.11 — cabinet "ripple" on jackpot/big wins. The frame applies a
  // damped sine-wave distortion via CSS animation: holographic edge
  // flexes outward, the whole cabinet feels like a struck bell.
  useEffect(() => {
    const off = bus.on('slot:win', (p) => {
      const el = frameRef.current
      if (!el) return
      el.classList.remove(styles.rippleJackpot ?? '', styles.rippleBig ?? '')
      // Force reflow so re-adding the class restarts the animation
      void el.offsetWidth
      const cls = p.type === 'jackpot' ? styles.rippleJackpot
                : p.type === 'big'     ? styles.rippleBig
                                       : null
      if (cls) {
        el.classList.add(cls)
        setTimeout(() => el.classList.remove(cls), 720)
      }

      // P3.5 — body-level vertigo push on jackpot (CSS hook in
      // styles/index.css reads --perf-pressure to auto-disable
      // under critical CPU load).
      if (p.type === 'jackpot') {
        document.body.setAttribute('data-jackpot', '')
        setTimeout(() => document.body.removeAttribute('data-jackpot'), 760)
      }
    })
    return off
  }, [])

  return (
    <div
      ref={frameRef}
      className={styles.frame}
      style={cellHeight > 0 ? { '--cell-h': `${cellHeight}px` } as React.CSSProperties : undefined}
      {...(isSpinning ? { 'data-frame-active': '' } : {})}
    >
      {/* V3 — LED side rails replace V1 fluted gold pillars.
          Always visible, animated chase pulse top→bottom. */}
      <CabinetSideRails />

      {/* Inner glow — activates during spin (violet wash) */}
      <div className={`${styles.innerGlow} ${isSpinning ? styles.innerGlowActive : ''}`} />

      {/* Content — the actual reel grid */}
      <div className={styles.content}>{children}</div>
    </div>
  )
}

export default Frame
