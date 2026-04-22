/**
 * App — Root component (CORTEX Engine powered)
 *
 * Three-phase flow modeled after real slot cabinets:
 *
 * Phase 1: BOOT (BootScreen)
 *   - Loading progress, CRT scanlines, "TAP TO BEGIN"
 *   - Tap = user gesture → AudioContext unlocked forever
 *
 * Phase 2: SPLASH (Attract Mode)
 *   - Titles animate in one by one WITH SFX (audio already unlocked!)
 *   - Lounge ambient music starts automatically
 *   - "PRESS TO ENTER" button waits for user
 *
 * Phase 3: SLOT (Main App)
 *   - Casino shower transition → slot machine portfolio
 *
 * All audio, animations, and timing driven by engine config.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { BootScreen } from './components/BootScreen'
import { SplashScreen } from './components/slot/SplashScreen'
import { SlotMachine } from './components/slot'
import { CasinoShower } from './components/slot/CasinoShower'
import { bus, initAudioBridge, disposeAudioBridge } from './engine'
import { SlotAudioManager } from './components/SlotAudioManager'

type AppPhase = 'boot' | 'splash' | 'entering' | 'slot'

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [showerActive, setShowerActive] = useState(false)
  const [introLocked, setIntroLocked] = useState(true)
  const slotWrapRef = useRef<HTMLDivElement>(null)
  const splashRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Pre-create ambient audio element (doesn't play until splash)
  useEffect(() => {
    const a = new Audio('/ambient/lounge.mp3')
    a.loop = true
    a.volume = 0.35
    audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  // Connect to CORTEX Audio Manager (WebSocket bridge)
  useEffect(() => {
    initAudioBridge()
    return () => disposeAudioBridge()
  }, [])

  // Boot complete → transition to splash
  const handleBootComplete = useCallback(() => {
    setPhase('splash')

    // Splash (z-index 2001) sits ABOVE the pre-shield (1999) and has its
    // own full-screen bg. The shield stays up — it masks the body slot-bg
    // until the splash→slot transition fades it out in handleEnter().

    // Start ambient music immediately (audio is unlocked from boot tap)
    const audio = audioRef.current
    if (audio) {
      audio.play().catch(() => {})
    }

    bus.emit('splash:start')
  }, [])

  // Splash enter → transition to slot
  const handleEnter = useCallback(() => {
    if (phase !== 'splash') return
    setPhase('entering')
    setShowerActive(true)

    bus.emit('splash:enter')

    const tl = gsap.timeline({
      onComplete: () => setPhase('slot'),
    })

    // Splash exit: smooth fade out as the shower starts (0 → 1.2s).
    // Shower timing: spawn 0-2.8s, fade out 3.4-4.2s, done at 4.2s.
    tl.to(splashRef.current, {
      opacity: 0,
      scale: 1.06,
      filter: 'blur(16px)',
      duration: 1.2,
      ease: 'power2.in',
    }, 0)

    // Slot entrance: frame + body slot-bg fade in together on the TAIL
    // of the shower — starts 2.5 s, ends 4.2 s (exactly when shower dies).
    tl.fromTo(slotWrapRef.current,
      { opacity: 0, filter: 'blur(10px)' },
      {
        opacity: 1,
        filter: 'blur(0px)',
        duration: 1.7,
        ease: 'power2.out',
      },
      2.5
    )

    // Pre-shield (masking body slot-bg) fades out in lockstep with the
    // slot wrapper — so bg image and reel frame reveal together.
    const shield = document.getElementById('pre-shield')
    if (shield) {
      tl.to(shield, {
        opacity: 0,
        duration: 1.7,
        ease: 'power2.out',
        onComplete: () => { shield.style.display = 'none' },
      }, 2.5)
    }
  }, [phase])

  const handleShowerDone = useCallback(() => {
    setShowerActive(false)
    setIntroLocked(false)
    bus.emit('transition:complete')
  }, [])

  return (
    <>
      {/* Slot machine — always mounted, hidden until transition */}
      <div
        ref={slotWrapRef}
        style={{
          opacity: phase === 'boot' || phase === 'splash' ? 0 : undefined,
          willChange: phase === 'entering' ? 'opacity, filter' : undefined,
        }}
      >
        <SlotMachine locked={introLocked} />
      </div>

      {/* Casino particle shower — coins, chips, dice rain */}
      <CasinoShower active={showerActive} onComplete={handleShowerDone} />

      {/* Splash — attract mode with auto SFX */}
      {(phase === 'splash' || phase === 'entering') && (
        <SplashScreen ref={splashRef} onEnter={handleEnter} />
      )}

      {/* Boot screen — on top of everything, removed after tap */}
      {phase === 'boot' && (
        <BootScreen onComplete={handleBootComplete} />
      )}

      {/* Slot Audio Manager — Shift+A to toggle */}
      <SlotAudioManager />
    </>
  )
}
