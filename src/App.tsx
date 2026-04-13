/**
 * App — Root component
 *
 * Splash intro → Slot machine portfolio
 */

import { useState } from 'react'
import { SplashScreen } from './components/slot/SplashScreen'
import { SlotMachine } from './components/slot'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)

  if (showSplash) {
    return <SplashScreen onEnter={() => setShowSplash(false)} />
  }

  return <SlotMachine />
}
