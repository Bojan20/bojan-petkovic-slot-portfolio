import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import styles from './SplashScreen.module.css'
import { cornerShimmer, labelWhoosh, nameReveal, lineSweep, buttonReady, unlockAudioCtx } from './splashSfx'

interface SplashScreenProps {
  onEnter: () => void
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

    // Entrance animation — waits for first user interaction so AudioContext can unlock
    useEffect(() => {
      let tl: gsap.core.Timeline | null = null
      let fired = false

      const startEntrance = () => {
        if (fired) return
        fired = true

        // Unlock AudioContext inside this gesture handler, then animate
        unlockAudioCtx().catch(() => {}).finally(() => {
          tl = gsap.timeline({ delay: 0.15 })

          tl.fromTo(cornersRef.current, { opacity: 0 }, {
            opacity: 1, duration: 0.8, ease: 'power2.out',
            onStart: () => cornerShimmer(),
          })

          tl.fromTo(labelRef.current,
            { opacity: 0, y: -20, letterSpacing: '0.3em' },
            {
              opacity: 1, y: 0, letterSpacing: '0.5em', duration: 0.7, ease: 'power3.out',
              onStart: () => labelWhoosh(),
            },
            '-=0.4'
          )

          tl.fromTo(nameRef.current,
            { opacity: 0, scale: 0.92, y: 30 },
            {
              opacity: 1, scale: 1, y: 0, duration: 1.0, ease: 'expo.out',
              onStart: () => nameReveal(),
            },
            '-=0.3'
          )

          tl.fromTo(lineRef.current,
            { scaleX: 0 },
            {
              scaleX: 1, duration: 0.6, ease: 'power2.inOut',
              onStart: () => lineSweep(),
            },
            '-=0.4'
          )

          tl.fromTo(btnRef.current,
            { opacity: 0, y: 15 },
            {
              opacity: 1, y: 0, duration: 0.5, ease: 'power2.out',
              onStart: () => buttonReady(),
              onComplete: () => setReady(true),
            },
            '-=0.1'
          )
        })
      }

      // First move/touch/key unlocks AudioContext and starts the animation
      document.addEventListener('pointermove', startEntrance, { once: true, passive: true })
      document.addEventListener('touchstart', startEntrance, { once: true, passive: true })
      document.addEventListener('keydown', startEntrance, { once: true, passive: true })

      return () => {
        document.removeEventListener('pointermove', startEntrance)
        document.removeEventListener('touchstart', startEntrance)
        document.removeEventListener('keydown', startEntrance)
        tl?.kill()
      }
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
        <div className={styles.particles}>
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className={styles.particle}
              style={{
                left: `${5 + Math.random() * 90}%`,
                top: `${5 + Math.random() * 90}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${4 + Math.random() * 4}s`,
                width: `${1 + Math.random() * 2}px`,
                height: `${1 + Math.random() * 2}px`,
              }}
            />
          ))}
        </div>

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
