/**
 * useSessionCapture — keyboard + voice command bindings for snapshot,
 * reel recording, and HID/Serial/HR pair flows.
 *
 * Extracted from App.tsx as part of the P1.13 refactor. The actual
 * engine functions are pure — this hook owns the keyboard listener
 * lifecycle and the voice-event subscriptions.
 *
 * Keybindings (all Ctrl/Cmd + Shift + …):
 *   S → exportSnapshot     (Phase 14)
 *   L → importSnapshot     (Phase 14)
 *   R → reel toggle        (Phase 15)
 *   H → pair HID           (Phase 16)
 *   Y → pair Serial        (Phase 20)
 *   B → pair HR monitor    (Phase 21)
 *
 * Voice commands (Phase 32):
 *   "save snapshot"  → export
 *   "load snapshot"  → import
 *   "record"         → reel toggle
 */

import { useEffect } from 'react'
import {
  bus,
  exportSnapshot, importSnapshot,
  startReelCapture, stopReelCapture, isReelCapturing,
  connectHidDevice, connectSerialDevice, connectHeartRateMonitor,
} from '../engine'

interface UseSessionCaptureOpts {
  /** Audio element to mix into recordings. */
  audioRef: React.RefObject<HTMLAudioElement | null>
}

export function useSessionCapture({ audioRef }: UseSessionCaptureOpts): void {
  // Keyboard bindings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod || !e.shiftKey || e.repeat) return

      if (e.code === 'KeyS') {
        e.preventDefault()
        void exportSnapshot().catch(() => {})
      } else if (e.code === 'KeyL') {
        e.preventDefault()
        void importSnapshot().catch(() => {})
      } else if (e.code === 'KeyR') {
        e.preventDefault()
        if (isReelCapturing()) {
          void stopReelCapture().catch(() => {})
        } else {
          void startReelCapture(audioRef.current).catch(() => {})
        }
      } else if (e.code === 'KeyH') {
        e.preventDefault()
        void connectHidDevice([]).catch(() => {})
      } else if (e.code === 'KeyY') {
        e.preventDefault()
        void connectSerialDevice(9600).catch(() => {})
      } else if (e.code === 'KeyB') {
        e.preventDefault()
        void connectHeartRateMonitor().catch(() => {})
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [audioRef])

  // Voice commands — save / load / record (Phase 32)
  useEffect(() => {
    const offSave = bus.on('voice:command:save', () => {
      void exportSnapshot().catch(() => {})
    })
    const offLoad = bus.on('voice:command:load', () => {
      void importSnapshot().catch(() => {})
    })
    const offRec = bus.on('voice:command:record', () => {
      if (isReelCapturing()) {
        void stopReelCapture().catch(() => {})
      } else {
        void startReelCapture(audioRef.current).catch(() => {})
      }
    })
    return () => { offSave(); offLoad(); offRec() }
  }, [audioRef])
}
