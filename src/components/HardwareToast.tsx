/**
 * HardwareToast — auto-detect surface for USB/BLE devices.
 *
 * navigator.hid + navigator.serial fire 'connect' events whenever a
 * compatible device is plugged in mid-session — but those events
 * still require a user-gesture pairing prompt to actually open the
 * device. This component listens for the gesture-free indicator
 * (document gains focus + a known device class is now present in
 * getDevices/getPorts that wasn't before) and surfaces a toast
 * that bridges to the pair flow without expecting the recruiter
 * to know Ctrl/Cmd+Shift+H exists.
 *
 * Strategy:
 *   1. On window focus events, snapshot getDevices + getPorts counts.
 *   2. Compare against the cached count from the previous focus.
 *   3. If a new HID/Serial device appeared while the tab was hidden
 *      (or away from focus), surface the toast.
 *   4. Toast offers a "PAIR NOW" button that runs the same connect
 *      flow Ctrl/Cmd+Shift+H/Y triggers — user just clicks once.
 *
 * Never auto-pairs. The picker is always user-initiated to satisfy
 * the WebHID + WebSerial security model.
 */

import { useEffect, useState } from 'react'
import styles from './HardwareToast.module.css'
import {
  isWebHidSupported,
  isWebSerialSupported,
  connectHidDevice,
  connectSerialDevice,
} from '../engine'

type Kind = 'hid' | 'serial'

interface ToastState {
  kind: Kind
  // Friendly label — shown in the toast body
  message: string
}

/**
 * Read counts from the platform queryers without prompting. Both
 * APIs return only devices the user has previously authorized; if
 * a new physical device is plugged in but not yet paired, count
 * stays the same (which is fine — we use the *focus* heuristic to
 * detect "user might have just plugged something in").
 */
async function readDeviceCounts(): Promise<{ hid: number; serial: number }> {
  let hid = 0
  let serial = 0
  if (isWebHidSupported()) {
    try {
      const devices = await (navigator as unknown as {
        hid: { getDevices: () => Promise<unknown[]> }
      }).hid.getDevices()
      hid = devices.length
    } catch { /* ignore */ }
  }
  if (isWebSerialSupported()) {
    try {
      const ports = await (navigator as unknown as {
        serial: { getPorts: () => Promise<unknown[]> }
      }).serial.getPorts()
      serial = ports.length
    } catch { /* ignore */ }
  }
  return { hid, serial }
}

export function HardwareToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!isWebHidSupported() && !isWebSerialSupported()) return

    let lastCount = { hid: 0, serial: 0 }
    let mounted = true
    let firstRunDone = false

    const checkOnFocus = async () => {
      const now = await readDeviceCounts()
      if (!mounted) return

      // First run sets the baseline silently — we only surface the
      // toast on a *delta* between focus events.
      if (!firstRunDone) {
        firstRunDone = true
        lastCount = now
        return
      }

      if (now.hid > lastCount.hid) {
        setToast({
          kind: 'hid',
          message: 'New HID device detected',
        })
      } else if (now.serial > lastCount.serial) {
        setToast({
          kind: 'serial',
          message: 'New serial device detected',
        })
      }
      lastCount = now
    }

    // Run once on mount to set the baseline; then on every focus
    void checkOnFocus()
    window.addEventListener('focus', checkOnFocus)

    return () => {
      mounted = false
      window.removeEventListener('focus', checkOnFocus)
    }
  }, [])

  if (!toast) return null

  const handlePair = () => {
    if (toast.kind === 'hid') {
      void connectHidDevice([])
    } else {
      void connectSerialDevice(9600)
    }
    setToast(null)
  }

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.icon} aria-hidden="true">
        {toast.kind === 'hid' ? '🎛️' : '🔌'}
      </span>
      <div className={styles.text}>
        <div className={styles.title}>HARDWARE</div>
        <div className={styles.body}>{toast.message}</div>
      </div>
      <button className={styles.btn} type="button" onClick={handlePair}>
        PAIR NOW
      </button>
      <button
        className={styles.dismiss}
        type="button"
        onClick={() => setToast(null)}
        aria-label="Dismiss"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export default HardwareToast
