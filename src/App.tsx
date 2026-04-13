/**
 * App — Root component
 *
 * Splash intro → casino shower → Slot machine portfolio
 * Both components coexist in DOM during transition.
 * Canvas particle rain (coins, chips, dice) bridges the gap.
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

    // Slot entrance: starts after shower gets going
    tl.fromTo(slotWrapRef.current,
      { opacity: 0, scale: 0.92, filter: 'blur(8px)' },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 1.4,
        ease: 'power2.out',
      },
      0.4  // starts 0.4s in — shower is already raining
    )
  }, [splashExiting])

  const handleShowerDone = useCallback(() => {
    setShowerActive(false)
  }, [])

  return (
    <>
      {/* Slot machine — always mounted, hidden until transition */}
      <div
        ref={slotWrapRef}
        style={{
          opacity: showSplash && !splashExiting ? 0 : undefined,
          willChange: splashExiting ? 'transform, opacity, filter' : undefined,
        }}
      >
        <SlotMachine />
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
