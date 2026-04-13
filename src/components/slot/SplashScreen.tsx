/**
 * SplashScreen — Attract Mode (CORTEX Engine powered)
 *
 * Titles animate in one by one. Each animation emits an event
 * on the EventBus → SoundManager plays the configured SFX.
 *
 * Audio is ALREADY UNLOCKED from BootScreen tap, so SFX play
 * automatically without any user interaction on this screen.
 *
 * This is "attract mode" in slot industry terminology —
 * the screen that draws in players with light and sound.
 */

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import styles from './SplashScreen.module.css'
import { bus } from '../../engine'

interface SplashScreenProps {
  onEnter: () => void
}

/** Seeded pseudo-random for deterministic particle positions */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

/** Static particle data — computed once at module load, not during render */
const PARTICLE_DATA = Array.from({ length: 20 }, (_, i) => ({
  left: `${5 + seededRandom(i * 6 + 1) * 90}%`,
  top: `${5 + seededRandom(i * 6 + 2) * 90}%`,
  animationDelay: `${seededRandom(i * 6 + 3) * 6}s`,
  animationDuration: `${4 + seededRandom(i * 6 + 4) * 4}s`,
  width: `${1 + seededRandom(i * 6 + 5) * 2}px`,
  height: `${1 + seededRandom(i * 6 + 6) * 2}px`,
}))

function Particles() {
  return (
    <div className={styles.particles}>
      {PARTICLE_DATA.map((p, i) => (
        <div key={i} className={styles.particle} style={p} />
      ))}
    </div>
  )
}

export const SplashScreen = forwardRef<HTMLDivElement, SplashScreenProps>(
  function SplashScreen({ onEnter }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const nameRef = useRef<HTMLDivElement>(null)
    const labelRef = useRef<HTMLDivElement>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    const cornersRef = useRef<HTMLDivElement>(null)
    const lineRef = useRef<HTMLDivElement>(null)
    const [ready, setReady] = useState(false)
    const enteredRef = useRef(false)

    // Merge forwarded ref with local ref
    const setRefs = useCallback((node: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }, [ref])

    // Entrance animation — GSAP timeline + EventBus events for SFX
    useEffect(() => {
      const tl = gsap.timeline({ delay: 0.2 })

      // Step 1: Corners
      tl.fromTo(cornersRef.current, { opacity: 0 }, {
        opacity: 1, duration: 0.8, ease: 'power2.out',
        onStart: () => bus.emit('splash:title:corners'),
      })

      // Step 2: Label
      tl.fromTo(labelRef.current,
        { opacity: 0, y: -20, letterSpacing: '0.3em' },
        {
          opacity: 1, y: 0, letterSpacing: '0.5em', duration: 0.7, ease: 'power3.out',
          onStart: () => bus.emit('splash:title:label'),
        },
        '-=0.4'
      )

      // Step 3: Name
      tl.fromTo(nameRef.current,
        { opacity: 0, scale: 0.92, y: 30 },
        {
          opacity: 1, scale: 1, y: 0, duration: 1.0, ease: 'expo.out',
          onStart: () => bus.emit('splash:title:name'),
        },
        '-=0.3'
      )

      // Step 4: Line
      tl.fromTo(lineRef.current,
        { scaleX: 0 },
        {
          scaleX: 1, duration: 0.6, ease: 'power2.inOut',
          onStart: () => bus.emit('splash:title:line'),
        },
        '-=0.4'
      )

      // Step 5: Button
      tl.fromTo(btnRef.current,
        { opacity: 0, y: 15 },
        {
          opacity: 1, y: 0, duration: 0.5, ease: 'power2.out',
          onStart: () => bus.emit('splash:title:button'),
          onComplete: () => setReady(true),
        },
        '-=0.1'
      )

      return () => { tl.kill() }
    }, [])

    // Button pulse animation
    useEffect(() => {
      if (!ready || !btnRef.current) return
      const pulse = gsap.to(btnRef.current, {
        boxShadow: '0 0 30px rgba(201,162,39,0.3), inset 0 0 20px rgba(201,162,39,0.05)',
        duration: 1.4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      return () => { pulse.kill() }
    }, [ready])

    // Handler — just calls parent, no local exit animation (App controls it)
    const handleEnter = useCallback(() => {
      if (enteredRef.current) return
      enteredRef.current = true
      onEnter()
    }, [onEnter])

    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          handleEnter()
        }
      }
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }, [handleEnter])

    return (
      <div ref={setRefs} className={styles.splash} onClick={handleEnter}>
        {/* Corner frames */}
        <div ref={cornersRef} className={styles.corners}>
          <div className={`${styles.corner} ${styles.tl}`} />
          <div className={`${styles.corner} ${styles.tr}`} />
          <div className={`${styles.corner} ${styles.bl}`} />
          <div className={`${styles.corner} ${styles.br}`} />
        </div>

        {/* Ambient particles */}
        <Particles />

        {/* Content */}
        <div className={styles.content}>
          <div ref={labelRef} className={styles.label}>
            AUDIO SLOT GAME DESIGNER — PORTFOLIO
          </div>

          <div ref={nameRef} className={styles.name}>
            BOJAN PETKOVIĆ
          </div>

          <div ref={lineRef} className={styles.line} />

          <button ref={btnRef} className={styles.enterBtn} type="button">
            PRESS TO ENTER
          </button>
        </div>
      </div>
    )
  }
)

export default SplashScreen
