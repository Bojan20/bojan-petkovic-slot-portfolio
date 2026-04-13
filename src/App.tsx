/**
 * App — Root component
 *
 * Splash intro → casino shower → Slot machine portfolio
 * Both components coexist in DOM during transition.
 * Canvas particle rain (coins, chips, dice) bridges the gap.
 *
 * Slot is interaction-locked until shower completes.
 * No scale animation on slot wrapper — prevents frame size jumps.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { SplashScreen } from './components/slot/SplashScreen'
import { SlotMachine } from './components/slot'
import { CasinoShower } from './components/slot/CasinoShower'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [splashExiting, setSplashExiting] = useState(false)
  const [showerActive, setShowerActive] = useState(false)
  const [introLocked, setIntroLocked] = useState(true)
  const slotWrapRef = useRef<HTMLDivElement>(null)
  const splashRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Pre-create audio element (doesn't play until user gesture)
  useEffect(() => {
    const a = new Audio('/ambient/lounge.mp3')
    a.loop = true
    a.volume = 0.35
    audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  const handleEnter = useCallback(() => {
    if (splashExiting) return
    setSplashExiting(true)
    setShowerActive(true)

    // Start ambient music on user gesture (autoplay blocked by browsers)
    const audio = audioRef.current
    if (audio) {
      audio.play().catch(() => {})
    }

    const tl = gsap.timeline({
      onComplete: () => setShowSplash(false),
    })

    // Splash exit: fade + blur + slight scale up
    tl.to(splashRef.current, {
      opacity: 0,
      scale: 1.06,
      filter: 'blur(16px)',
      duration: 1.2,
      ease: 'power3.in',
    }, 0)

    // Slot entrance: slow fade-in over full shower duration (4.2s)
    // opacity + blur ease in together — slot and background reveal gradually
    tl.fromTo(slotWrapRef.current,
      { opacity: 0, filter: 'blur(12px)' },
      {
        opacity: 1,
        filter: 'blur(0px)',
        duration: 3.8,
        ease: 'power1.inOut',
      },
      0.3
    )
  }, [splashExiting])

  const handleShowerDone = useCallback(() => {
    setShowerActive(false)
    setIntroLocked(false)
  }, [])

  return (
    <>
      {/* Slot machine — always mounted, hidden until transition */}
      <div
        ref={slotWrapRef}
        style={{
          opacity: showSplash && !splashExiting ? 0 : undefined,
          willChange: splashExiting ? 'opacity, filter' : undefined,
        }}
      >
        <SlotMachine locked={introLocked} />
      </div>

      {/* Casino particle shower — coins, chips, dice rain */}
      <CasinoShower active={showerActive} onComplete={handleShowerDone} />

      {/* Splash — on top, removed after transition */}
      {showSplash && (
        <SplashScreen ref={splashRef} onEnter={handleEnter} />
      )}
    </>
  )
}
