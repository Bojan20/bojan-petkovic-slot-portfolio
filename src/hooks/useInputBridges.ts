/**
 * useInputBridges — auto-bind WebHID + WebSerial paired devices.
 *
 * Extracted from App.tsx as part of the P1.13 refactor. Owns the
 * lifecycle of both input bridges in a single hook so App.tsx
 * doesn't carry two near-identical useEffect blocks.
 *
 * Initial pairing for either bridge requires a user gesture (the
 * picker) — those flows live behind Ctrl/Cmd+Shift+H/Y keybindings
 * and the HardwareToast PAIR NOW button. This hook only handles
 * silent re-bind to already-authorized devices.
 *
 * No-op silently on browsers without navigator.hid / navigator.serial
 * (Firefox, Safari).
 */

import { useEffect } from 'react'
import {
  startHidAutoBind, stopHidAutoBind,
  startSerialAutoBind, stopSerialAutoBind,
} from '../engine'

export function useInputBridges(serialBaud = 9600): void {
  useEffect(() => {
    void startHidAutoBind()
    return () => { void stopHidAutoBind() }
  }, [])

  useEffect(() => {
    void startSerialAutoBind(serialBaud)
    return () => { void stopSerialAutoBind() }
  }, [serialBaud])
}
