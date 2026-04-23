/**
 * useAmbientPhaseSync — system-level bus→store subscriber that keeps
 * the coarse-grained `ambientPhase` in sync with slot machine events.
 *
 * Mount once at the app shell level (e.g. in `App.tsx` or a top-level
 * provider). It listens to the CORTEX bus and flips `ambientPhase`
 * via the slot store actions — respecting the invariant that stores
 * never subscribe to the bus directly.
 *
 * Flow:
 *   slot:spin:start → ambientPhase = 'spinning'
 *   slot:spin:stop  → ambientPhase = 'landing'   (for ~300ms)
 *                   → ambientPhase = 'idle'
 *   slot:win        → ambientPhase = 'winning'   (for ~1200ms)
 *                   → ambientPhase = 'idle'
 *
 * The `winning` pulse takes priority over the `landing` tail if both
 * fire in the same window (wins happen on stop), so the stop-handler
 * checks the current phase before flipping back to idle.
 */

import { useEffect, useRef } from 'react'
import { bus } from '../engine/EventBus'
import { useSlotStore } from '../store/slotStore'

const LANDING_MS = 300
const WINNING_MS = 1200

export function useAmbientPhaseSync(): void {
  // Use a ref so the effect below doesn't re-subscribe on every render.
  // Store actions are stable references, so we only need to read once.
  const setAmbientPhase = useSlotStore((s) => s.setAmbientPhase)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const offStart = bus.on('slot:spin:start', () => {
      clearTimer()
      setAmbientPhase('spinning')
    })

    const offStop = bus.on('slot:spin:stop', () => {
      clearTimer()
      setAmbientPhase('landing')
      timerRef.current = window.setTimeout(() => {
        // Only fall back to idle if nothing else (e.g. a `winning` pulse)
        // has already taken over in the meantime.
        const current = useSlotStore.getState().ambientPhase
        if (current === 'landing') setAmbientPhase('idle')
        timerRef.current = null
      }, LANDING_MS)
    })

    const offWin = bus.on('slot:win', () => {
      clearTimer()
      setAmbientPhase('winning')
      timerRef.current = window.setTimeout(() => {
        const current = useSlotStore.getState().ambientPhase
        if (current === 'winning') setAmbientPhase('idle')
        timerRef.current = null
      }, WINNING_MS)
    })

    return () => {
      clearTimer()
      offStart()
      offStop()
      offWin()
    }
  }, [setAmbientPhase])
}
