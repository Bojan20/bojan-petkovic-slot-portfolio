import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import styles from './SplashScreen.module.css'

interface SplashScreenProps {
  onEnter: () => void
}

export function SplashScreen({ onEnter }: SplashScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLDivElement>(null)
const labelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const cornersRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  // Measure name width → CSS custom property for SlotMachine
  useEffect(() => {
    function measureName() {
      const el = nameRef.current
      if (!el) return
      const w = el.getBoundingClientRect().width
      if (w > 0) {
        document.documentElement.style.setProperty('--name-width', `${Math.round(w)}px`)
      }
    }
    measureName()
    window.addEventListener('resize', measureName)
    return () => window.removeEventListener('resize', measureName)
  }, [])

  // Entrance animation
  useEffect(() => {
    const tl = gsap.timeline({ delay: 0.2 })

    // Corners fade in
    tl.fromTo(cornersRef.current, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' })

    // Top label
    tl.fromTo(labelRef.current,
      { opacity: 0, y: -20, letterSpacing: '0.3em' },
      { opacity: 1, y: 0, letterSpacing: '0.5em', duration: 0.7, ease: 'power3.out' },
      '-=0.4'
    )

    // Name — dramatic reveal
    tl.fromTo(nameRef.current,
      { opacity: 0, scale: 0.92, y: 30 },
      { opacity: 1, scale: 1, y: 0, duration: 1.0, ease: 'expo.out' },
      '-=0.3'
    )

    // Horizontal line
    tl.fromTo(lineRef.current,
      { scaleX: 0 },
      { scaleX: 1, duration: 0.6, ease: 'power2.inOut' },
      '-=0.4'
    )

    // Button pulse in
    tl.fromTo(btnRef.current,
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', onComplete: () => setReady(true) },
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

  // Keyboard + click handler
  const handleEnter = useCallback(() => {
    if (!containerRef.current) return
    // Exit animation
    gsap.to(containerRef.current, {
      opacity: 0,
      scale: 1.05,
      filter: 'blur(12px)',
      duration: 0.6,
      ease: 'power2.in',
      onComplete: onEnter,
    })
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
    <div ref={containerRef} className={styles.splash} onClick={handleEnter}>
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
          AUDIO GAME DESIGNER · PORTFOLIO
        </div>

        <div ref={nameRef} className={styles.name}>
          BOJAN PETKOVIĆ
        </div>

        <div ref={lineRef} className={styles.line} />

        <button ref={btnRef} className={styles.enterBtn} type="button">
          PRESS SPACE
        </button>
      </div>
    </div>
  )
}

export default SplashScreen
