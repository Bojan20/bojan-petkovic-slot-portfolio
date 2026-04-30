import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Frame.module.css'
import { bus } from '../../engine'

interface FrameProps {
  children: ReactNode
  isSpinning: boolean
  cellHeight?: number
}

export function Frame({ children, isSpinning, cellHeight = 0 }: FrameProps) {
  const frameRef = useRef<HTMLDivElement>(null)

  // P1.11 — cabinet "ripple" deformation on jackpot wins.
  // When slot:win[jackpot] fires, the frame applies a damped sine-wave
  // distortion via CSS animation: corner medallions ripple outward,
  // pillars flex slightly, the whole cabinet feels like a struck bell.
  // On big/medium wins we fire a smaller flex; small wins are silent
  // (audio cue carries them).
  useEffect(() => {
    const off = bus.on('slot:win', (p) => {
      const el = frameRef.current
      if (!el) return
      // Stagger the class so re-firing during rapid wins re-triggers
      // the animation instead of being suppressed by CSS dedupe
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

      // P3.5 — cabinet VERTIGO PUSH on jackpot (CSS hook on <body>).
      // Augments the per-frame ripple with a body-level dolly: the
      // entire viewport scales up briefly and the perimeter darkens
      // → recruiter feels the camera lunging at the cabinet at the
      // exact moment of the jackpot. body[data-jackpot] CSS lives
      // in styles/index.css so it can read --perf-pressure to
      // auto-disable on critical CPU load.
      if (p.type === 'jackpot') {
        document.body.setAttribute('data-jackpot', '')
        // Match the ripple's full duration so both effects close out
        // together; flag clears slightly later so the keyframe fully
        // finishes before the attribute is removed.
        setTimeout(() => document.body.removeAttribute('data-jackpot'), 760)
      }
    })
    return off
  }, [])

  // P4.2 — chrome dimming. Frame chrome (pillars + medallions +
  // topStrip + chromatic edge) idles at --chrome-strength 0.22 so
  // the recruiter's eye lands on content, not bezel. Spinning the
  // reels OR hovering the cabinet brightens chrome to full via CSS
  // — cabinet "wakes up" when interacted with.
  return (
    <div
      ref={frameRef}
      className={styles.frame}
      style={cellHeight > 0 ? { '--cell-h': `${cellHeight}px` } as React.CSSProperties : undefined}
      {...(isSpinning ? { 'data-frame-active': '' } : {})}
    >
      {/* Left pillar */}
      <div className={`${styles.pillar} ${styles.left}`} />

      {/* Right pillar */}
      <div className={`${styles.pillar} ${styles.right}`} />

      {/* Corner medallions */}
      <div className={`${styles.medallion} ${styles.tl}`} />
      <div className={`${styles.medallion} ${styles.tr}`} />
      <div className={`${styles.medallion} ${styles.bl}`} />
      <div className={`${styles.medallion} ${styles.br}`} />

      {/* Top cold-light reflection strip */}
      <div className={styles.topStrip} />

      {/* Inner glow — activates during spin */}
      <div className={`${styles.innerGlow} ${isSpinning ? styles.innerGlowActive : ''}`} />

      {/* Content */}
      <div className={styles.content}>{children}</div>
    </div>
  )
}

export default Frame
