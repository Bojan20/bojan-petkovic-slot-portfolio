/**
 * useSoftFunnel — §2.11 Soft conversion escalation
 *
 * Three non-blocking commitment escalators that surface as the recruiter
 * engages. Each is dismissible; none block content.
 *
 *   30s → subtle hint below spin button: "↓ SPIN for next project"
 *   60s → toast: "Enjoying the work? Reach out →"
 *  120s → highlight REACH tab (flash pill once)
 *
 * Returns state flags consumed by SlotMachine + App shell.
 * Timers reset on section change (fresh engagement).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { bus } from '../engine'

interface SoftFunnelState {
  showSpinHint: boolean
  showEngageToast: boolean
  dismissSpinHint: () => void
  dismissEngageToast: () => void
}

export function useSoftFunnel(active: boolean): SoftFunnelState {
  const [showSpinHint, setShowSpinHint] = useState(false)
  const [showEngageToast, setShowEngageToast] = useState(false)
  const t30 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t60 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t120 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastShownRef = useRef(false)
  const reachFlashShownRef = useRef(false)

  const clearAll = useCallback(() => {
    if (t30.current)  clearTimeout(t30.current)
    if (t60.current)  clearTimeout(t60.current)
    if (t120.current) clearTimeout(t120.current)
  }, [])

  useEffect(() => {
    if (!active) { clearAll(); return }

    t30.current = setTimeout(() => {
      setShowSpinHint(true)
    }, 30_000)

    t60.current = setTimeout(() => {
      if (!toastShownRef.current) {
        toastShownRef.current = true
        setShowEngageToast(true)
        // Auto-dismiss toast after 7s
        setTimeout(() => setShowEngageToast(false), 7_000)
      }
    }, 60_000)

    t120.current = setTimeout(() => {
      if (!reachFlashShownRef.current) {
        reachFlashShownRef.current = true
        // Flash the REACH pill by faking a cell select event
        bus.emit('slot:item:select', { col: 0, row: 1 })
      }
    }, 120_000)

    return clearAll
  }, [active, clearAll])

  // Reset 30s hint on any section change (keep toasts — they only show once)
  useEffect(() => {
    const off = bus.on('slot:section:change', () => {
      setShowSpinHint(false)
      if (t30.current) clearTimeout(t30.current)
      if (!active) return
      t30.current = setTimeout(() => setShowSpinHint(true), 30_000)
    })
    return off
  }, [active])

  return {
    showSpinHint,
    showEngageToast,
    dismissSpinHint: () => setShowSpinHint(false),
    dismissEngageToast: () => setShowEngageToast(false),
  }
}
