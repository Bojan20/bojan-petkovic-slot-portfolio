/**
 * CabinetCamera — V4.0 cinematic camera layer.
 *
 * Treats the viewport itself as a camera looking at the cabinet.
 * Subscribes to high-impact bus events and sets body[data-camera]
 * which the global CSS reads to drive viewport-level effects:
 *
 *   idle-float    slow ±0.2deg sway, 12s loop, always on
 *   punch-in      120ms scale 0.992 → 1 (camera "lunges" toward cell)
 *   shake-medium  200ms 1px micro-shake (medium win)
 *   shake-big     350ms 2-3px shake (big win)
 *   shake-jackpot 600ms 3-5px shake + brief blur (jackpot)
 *
 * The data attribute auto-clears after each transient effect.
 * Idle-float runs continuously when no transient is active.
 *
 * Why body-level: every viewport-relative element (slot, world,
 * overlays, menus) gets the camera motion for free, no per-component
 * wiring. CSS animations on body inherit through.
 */

import { useEffect, useRef } from 'react'
import { bus } from '../../../engine'

type CamState =
  | 'idle-float'
  | 'punch-in'
  | 'shake-small'
  | 'shake-medium'
  | 'shake-big'
  | 'shake-jackpot'

const TIER_DURATIONS: Partial<Record<CamState, number>> = {
  'punch-in': 320,
  'shake-small': 180,
  'shake-medium': 280,
  'shake-big': 480,
  'shake-jackpot': 720,
}

export function CabinetCamera() {
  const decayRef = useRef<number>(0)

  useEffect(() => {
    const body = document.body

    // V4.4 — gate idle-float on phase=slot only. During boot/splash/
    // entering the body must NOT animate or the corners of the boot
    // and splash screens flicker (body-level transform causes paint
    // reflow that's visible at the viewport edges).
    const isSlotPhase = () => body.dataset.phase === 'slot'
    const applyIdleIfSlot = () => {
      if (isSlotPhase()) {
        body.setAttribute('data-camera', 'idle-float')
      } else {
        body.removeAttribute('data-camera')
      }
    }
    // Initial sync
    applyIdleIfSlot()

    // Watch body[data-phase] — when phase flips to/from 'slot' we
    // (de)activate idle-float. The phase attr is set by App.tsx
    // useEffect on every phase change.
    const phaseObserver = new MutationObserver(applyIdleIfSlot)
    phaseObserver.observe(body, { attributes: true, attributeFilter: ['data-phase'] })

    const setCam = (state: CamState) => {
      // Only fire transient camera effects in slot phase. Earlier
      // phases own their own cinematics (TransitionDirector).
      if (!isSlotPhase()) return
      body.setAttribute('data-camera', state)
      const dur = TIER_DURATIONS[state]
      if (!dur) return
      if (decayRef.current) window.clearTimeout(decayRef.current)
      decayRef.current = window.setTimeout(() => {
        body.setAttribute('data-camera', 'idle-float')
        decayRef.current = 0
      }, dur)
    }

    const offSpinStart = bus.on('slot:spin:start', () => setCam('punch-in'))

    const offReelStop = bus.on('slot:reel:stop', () => {
      // Each reel stop punches the camera slightly — total 5 stops,
      // last one is the heaviest. Keep light so it doesn't conflict
      // with the win shake that follows.
      setCam('shake-small')
    })

    const offWin = bus.on('slot:win', (p) => {
      const tier = p.type ?? 'small'
      setCam(
        tier === 'jackpot' ? 'shake-jackpot'
        : tier === 'big'   ? 'shake-big'
        : tier === 'medium' ? 'shake-medium'
        : 'shake-small',
      )
    })

    // Cell click — small camera punch (the user committed to
    // something, the camera acknowledges it)
    const offCellClick = bus.on(
      'custom:cell:click' as 'custom:cell:click',
      () => setCam('punch-in'),
    )

    return () => {
      offSpinStart()
      offReelStop()
      offWin()
      offCellClick()
      phaseObserver.disconnect()
      if (decayRef.current) window.clearTimeout(decayRef.current)
      body.removeAttribute('data-camera')
    }
  }, [])

  return null
}

export default CabinetCamera
