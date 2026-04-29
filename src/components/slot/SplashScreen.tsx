/**
 * SplashScreen — Attract Mode (Cyberpunk cinematic)
 *
 * 5-step GSAP timeline with:
 *   1. Lucky 7 3D entrance + lens flare sweep
 *   2. Label glitch reveal (RGB chromatic separation)
 *   3. Name glitch reveal
 *   4. Power core charging rings (staggered implosion)
 *   5. Line reveal + ready state
 *
 * Audio is ALREADY UNLOCKED from BootScreen tap, so SFX play
 * automatically. Each animation emits a bus event.
 */

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import styles from './SplashScreen.module.css'
import { bus } from '../../engine'

/** Circumference of countdown ring (r=42, 2πr ≈ 263.9) */
const RING_CIRC = 2 * Math.PI * 42

interface SplashScreenProps {
  onEnter: () => void
}

/** Seeded pseudo-random for deterministic particle positions */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

/** Static particle data — computed once at module load, not during render */
const PARTICLE_DATA = Array.from({ length: 28 }, (_, i) => ({
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
    const sevenRef = useRef<HTMLDivElement>(null)
    const flareRef = useRef<HTMLDivElement>(null)
    const nameRef = useRef<HTMLDivElement>(null)
    const labelRef = useRef<HTMLDivElement>(null)
    const cornersRef = useRef<HTMLDivElement>(null)
    const lineRef = useRef<HTMLDivElement>(null)
    const coreRef = useRef<HTMLDivElement>(null)
    const [ready, setReady] = useState(false)
    const [countdown, setCountdown] = useState(0) // 0..1 over 3s
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

      // Step 1a: Corners
      tl.fromTo(cornersRef.current, { opacity: 0 }, {
        opacity: 1, duration: 0.6, ease: 'power2.out',
        onStart: () => bus.emit('splash:title:corners'),
      }, 0)

      // Step 1b: Lucky 7 — 3D rotateY entrance (fade + blur + depth pop)
      // Position/scale are driven by CSS custom properties --seven-y / --seven-scale
      // so the entrance here only touches opacity + filter (no transform conflict).
      tl.fromTo(sevenRef.current,
        { opacity: 0, filter: 'blur(28px)', '--seven-scale': 0.75 },
        { opacity: 1, filter: 'blur(0px)', '--seven-scale': 1, duration: 0.6, ease: 'expo.out' },
        0.05,
      )
      // Lens flare sweep (left → right across the 7)
      tl.fromTo(flareRef.current,
        { xPercent: -140, opacity: 0 },
        { xPercent: 140, opacity: 1, duration: 0.8, ease: 'power2.inOut' },
        0.3,
      )
      tl.to(flareRef.current, { opacity: 0, duration: 0.2 }, '>')

      // Step 2: Label with glitch
      tl.fromTo(labelRef.current,
        { opacity: 0, y: -20, letterSpacing: '0.3em' },
        {
          opacity: 1, y: 0, letterSpacing: '0.5em', duration: 0.5, ease: 'power3.out',
          onStart: () => {
            bus.emit('splash:title:label')
            // Trigger 150 ms chromatic glitch via class
            labelRef.current?.classList.add(styles.glitchOn as string)
            setTimeout(() => labelRef.current?.classList.remove(styles.glitchOn as string), 180)
          },
        },
        '-=0.2',
      )

      // Step 3: Name with glitch + simultaneous Lucky 7 morph to under-name position
      tl.fromTo(nameRef.current,
        { opacity: 0, scale: 0.92, y: 30 },
        {
          opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'expo.out',
          onStart: () => {
            bus.emit('splash:title:name')
            nameRef.current?.classList.add(styles.glitchOn as string)
            setTimeout(() => nameRef.current?.classList.remove(styles.glitchOn as string), 220)
          },
        },
        '-=0.15',
      )

      // Seven glides to "logo under name" spot + scales down — smooth morph
      // synchronized with name reveal, lands just after name finishes
      tl.to(sevenRef.current, {
        '--seven-y': '38%',
        '--seven-scale': '0.42',
        duration: 1.1,
        ease: 'power3.inOut',
      }, '<')

      // Step 4: Power core charging — 3 concentric rings implode in
      tl.fromTo(coreRef.current, { opacity: 0 }, {
        opacity: 1, duration: 0.3,
      }, '-=0.4')

      // Step 5: Line reveal → ready
      tl.fromTo(lineRef.current,
        { scaleX: 0 },
        {
          scaleX: 1, duration: 0.55, ease: 'power2.inOut',
          onStart: () => bus.emit('splash:title:line'),
          onComplete: () => setReady(true),
        },
        '-=0.2',
      )

      return () => { tl.kill() }
    }, [])

    // Countdown ring — fills over 3s after splash is ready, then auto-enters
    useEffect(() => {
      if (!ready) return
      const dur = 3000
      const start = performance.now()
      let raf: number
      const tick = () => {
        const p = Math.min((performance.now() - start) / dur, 1)
        setCountdown(p)
        if (p < 1) {
          raf = requestAnimationFrame(tick)
        } else if (!enteredRef.current) {
          enteredRef.current = true
          onEnter()
        }
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready])

    // Handler — tap ripple + enter
    const handleEnter = useCallback((e?: React.MouseEvent<HTMLDivElement>) => {
      if (enteredRef.current) return

      // Tap ripple — concentric gold rings from click point
      if (e && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        for (let i = 0; i < 3; i++) {
          const ripple = document.createElement('div')
          ripple.className = styles.tapRipple ?? 'tapRipple'
          ripple.style.left = `${x}px`
          ripple.style.top = `${y}px`
          ripple.style.animationDelay = `${i * 0.12}s`
          containerRef.current.appendChild(ripple)
          setTimeout(() => ripple.remove(), 1100)
        }
      }

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
      <div ref={setRefs} className={styles.splash} onClick={(e) => handleEnter(e)}>
        {/* Holographic grid floor — perspective grid rising from bottom */}
        <div className={styles.gridFloor} aria-hidden="true" />

        {/* Animated SVG turbulence noise — ambient cyberpunk grain */}
        <svg className={styles.noiseLayer} aria-hidden="true">
          <filter id="splashTurb">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.2  0 0 0 0 1  0 0 0 0.12 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#splashTurb)" />
        </svg>

        {/* Star-field parallax tačke */}
        <div className={styles.starField} aria-hidden="true">
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className={styles.star}
              style={{
                left: `${seededRandom(i * 3 + 11) * 100}%`,
                top: `${seededRandom(i * 3 + 17) * 100}%`,
                animationDelay: `${seededRandom(i * 3 + 5) * 5}s`,
                animationDuration: `${3 + seededRandom(i * 3 + 9) * 4}s`,
                opacity: 0.15 + seededRandom(i * 3 + 23) * 0.4,
              }}
            />
          ))}
        </div>

        {/* Corner frames */}
        <div ref={cornersRef} className={styles.corners}>
          <div className={`${styles.corner} ${styles.tl}`} />
          <div className={`${styles.corner} ${styles.tr}`} />
          <div className={`${styles.corner} ${styles.bl}`} />
          <div className={`${styles.corner} ${styles.br}`} />
        </div>

        {/* Ambient particles */}
        <Particles />

        {/* Lucky 7 cinematic 3D entrance + lens flare */}
        <div ref={sevenRef} className={styles.sevenStage} aria-hidden="true">
          <img src="/seven-cyber.png" alt="" className={styles.sevenImg} draggable={false} />
          <div ref={flareRef} className={styles.lensFlare} />
        </div>

        {/* Power core — 3 concentric charging rings */}
        <div ref={coreRef} className={styles.powerCore} aria-hidden="true">
          <svg className={styles.coreSvg} viewBox="0 0 200 200">
            <circle className={styles.ring1} cx="100" cy="100" r="90" />
            <circle className={styles.ring2} cx="100" cy="100" r="68" />
            <circle className={styles.ring3} cx="100" cy="100" r="46" />
            <circle className={styles.coreDot} cx="100" cy="100" r="4" />
          </svg>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div
            ref={labelRef}
            className={styles.label}
            data-text="AUDIO SLOT GAME DESIGNER — PORTFOLIO"
          >
            AUDIO SLOT GAME DESIGNER — PORTFOLIO
          </div>

          <div className={styles.nameWrap}>
            <div
              ref={nameRef}
              className={styles.name}
              data-text="BOJAN PETKOVIĆ"
            >
              BOJAN PETKOVIĆ
            </div>
            <div className={styles.hologramOverlay} aria-hidden="true" />
            <div className={styles.spectrumAberration} aria-hidden="true" />
          </div>

          <div ref={lineRef} className={styles.line} />
        </div>

        {/* Countdown ring — SVG circle fills over 3s, signals auto-enter */}
        <svg
          className={`${styles.countdownRing} ${ready ? styles.countdownRingVisible : ''}`}
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle className={styles.countdownTrack} cx="50" cy="50" r="42" />
          <circle
            className={styles.countdownFill}
            cx="50" cy="50" r="42"
            strokeDasharray={`${countdown * RING_CIRC} ${RING_CIRC}`}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
        </svg>
      </div>
    )
  },
)

export default SplashScreen
