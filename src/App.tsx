/**
 * App — Root component
 *
 * Splash intro → cinematic transition → Slot machine portfolio
 * Both components coexist in DOM during transition for seamless blend.
 */

import { useCallback, useRef, useState } from 'react'
import gsap from 'gsap'
import { SplashScreen } from './components/slot/SplashScreen'
import { SlotMachine } from './components/slot'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [splashExiting, setSplashExiting] = useState(false)
  const slotWrapRef = useRef<HTMLDivElement>(null)
  const splashRef = useRef<HTMLDivElement>(null)

  const handleEnter = useCallback(() => {
    if (splashExiting) return
    setSplashExiting(true)

    const tl = gsap.timeline({
      onComplete: () => setShowSplash(false),
    })

    // Splash exit: fade + blur + slight scale up
    tl.to(splashRef.current, {
      opacity: 0,
      scale: 1.06,
      filter: 'blur(16px)',
      duration: 1.0,
      ease: 'power3.in',
    }, 0)

    // Slot entrance: starts slightly before splash fully gone
    // Scale from 0.92 → 1, opacity 0 → 1, slight blur clear
    tl.fromTo(slotWrapRef.current,
      { opacity: 0, scale: 0.92, filter: 'blur(8px)' },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 1.2,
        ease: 'power2.out',
      },
      0.25  // starts 0.25s after splash begins fading
    )
  }, [splashExiting])

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

      {/* Splash — on top, removed after transition */}
      {showSplash && (
        <SplashScreen ref={splashRef} onEnter={handleEnter} />
      )}
    </>
  )
}
