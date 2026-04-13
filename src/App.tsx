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

import { useCallback, useRef, useState } from 'react'
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

  const handleEnter = useCallback(() => {
    if (splashExiting) return
    setSplashExiting(true)
    setShowerActive(true)

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

    // Slot entrance: opacity + blur only — NO scale (prevents frame size jumping)
    tl.fromTo(slotWrapRef.current,
      { opacity: 0, filter: 'blur(8px)' },
      {
        opacity: 1,
        filter: 'blur(0px)',
        duration: 1.4,
        ease: 'power2.out',
      },
      0.4
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
