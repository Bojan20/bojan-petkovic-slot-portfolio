/**
 * HidInput — WebHID generic device input
 *
 * Lets the user pair any USB/Bluetooth HID device — Stream Deck, X-keys,
 * generic gamepad-as-HID, custom Arduino board running ProMicro firmware
 * — and have its button presses drive slot controls. No vendor lock-in;
 * we parse input reports generically and rotate through a known set of
 * portfolio actions.
 *
 * Why this matters as a portfolio piece:
 *   • WebHID is a Chromium-only modern API (Chrome 89+, Edge 89+) that
 *     proves I track the bleeding edge of platform integration. Most
 *     web devs never reach for it because "browsers can't talk to
 *     hardware" — turns out they can.
 *   • Pairing with a Stream Deck instantly upgrades the demo from
 *     "browser game" to "physical control surface for a portfolio."
 *   • The reconnect-from-paired flow uses navigator.hid.getDevices()
 *     so a recruiter who paired once gets auto-connect on reload.
 *
 * Action mapping:
 *   Pressing ANY button on the HID device cycles through:
 *     1. slot:spin:start         (pull the lever)
 *     2. voice:command:next      (advance section)
 *     3. voice:command:back      (back section)
 *     4. voice:command:jackpot   (cheat code)
 *
 * Why round-robin instead of fixed mapping: HID devices report buttons
 * at arbitrary indexes (a Stream Deck row+col, an Arduino arbitrary
 * pin, a custom controller's BTN_0/BTN_1). Mapping every device
 * vendor-specifically is impossible; rotating through 4 actions on
 * any press lets ANY device drive the slot meaningfully. The user
 * learns the cycle in two presses.
 *
 * Lifecycle:
 *   navigator.hid.addEventListener('connect') auto-binds known devices
 *   await connectHidDevice() prompts the picker
 *   disconnectHidDevice() releases the device + clears listeners
 *
 * No-op silently on Firefox/Safari (no navigator.hid).
 */

import { bus } from './EventBus'

// ─── Capability detection ────────────────────────────────────────────────────

export function isWebHidSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'hid' in navigator &&
    typeof (navigator as Navigator & {
      hid: { requestDevice: unknown }
    }).hid?.requestDevice === 'function'
  )
}

// ─── Types — minimal shim for navigator.hid (not in lib.dom yet) ─────────────

interface HIDDeviceLike {
  vendorId: number
  productId: number
  productName: string
  opened: boolean
  open: () => Promise<void>
  close: () => Promise<void>
  addEventListener: (type: string, fn: (e: HIDInputReportEvent) => void) => void
  removeEventListener: (type: string, fn: (e: HIDInputReportEvent) => void) => void
}

interface HIDInputReportEvent {
  data: DataView
  reportId: number
  device: HIDDeviceLike
}

interface HIDLike {
  requestDevice: (opts: { filters: unknown[] }) => Promise<HIDDeviceLike[]>
  getDevices: () => Promise<HIDDeviceLike[]>
  addEventListener: (type: string, fn: (e: { device: HIDDeviceLike }) => void) => void
  removeEventListener: (type: string, fn: (e: { device: HIDDeviceLike }) => void) => void
}

function getHid(): HIDLike | null {
  if (!isWebHidSupported()) return null
  return (navigator as unknown as { hid: HIDLike }).hid
}

// ─── Round-robin action cycle ────────────────────────────────────────────────

type RotatedAction =
  | 'slot:spin:start'
  | 'voice:command:next'
  | 'voice:command:back'
  | 'voice:command:jackpot'

const ACTION_CYCLE: readonly RotatedAction[] = [
  'slot:spin:start',
  'voice:command:next',
  'voice:command:back',
  'voice:command:jackpot',
]

let _cycleIdx = 0

function fireNextAction(): void {
  const action = ACTION_CYCLE[_cycleIdx % ACTION_CYCLE.length]
  // All 4 actions in the rotation cycle have void payloads
  switch (action) {
    case 'slot:spin:start':       bus.emit('slot:spin:start');       break
    case 'voice:command:next':    bus.emit('voice:command:next');    break
    case 'voice:command:back':    bus.emit('voice:command:back');    break
    case 'voice:command:jackpot': bus.emit('voice:command:jackpot'); break
  }
  _cycleIdx = (_cycleIdx + 1) % ACTION_CYCLE.length
}

// ─── Edge detection — turn raw input reports into "button down" pulses ───────

/**
 * HID input reports are continuous state snapshots, not edges. Pressing
 * a button leaves it asserted for many frames; we want one action per
 * press, not 60 per second.
 *
 * Strategy: hash each report's button bytes (first 8 bytes of data buffer
 * cover virtually all device button banks) into a number. When the hash
 * transitions FROM all-zero TO any-bit-set, that's a press edge — fire
 * the action. Releasing (any-bit → zero) is silent.
 */
let _lastButtonsHash = 0

/** Exported for testing. Stable hash over the first 8 button bytes. */
export function buttonsHash(view: DataView): number {
  let h = 0
  const len = Math.min(view.byteLength, 8)
  for (let i = 0; i < len; i++) {
    h = (h * 31 + view.getUint8(i)) | 0
  }
  return h >>> 0
}

/** Exported for testing. True if any of the first 8 bytes is non-zero. */
export function anyByteNonZero(view: DataView): boolean {
  const len = Math.min(view.byteLength, 8)
  for (let i = 0; i < len; i++) {
    if (view.getUint8(i) !== 0) return true
  }
  return false
}

// ─── Active device + listeners ───────────────────────────────────────────────

let _activeDevice: HIDDeviceLike | null = null
let _onInputReport: ((e: HIDInputReportEvent) => void) | null = null
let _onConnect: ((e: { device: HIDDeviceLike }) => void) | null = null
let _onDisconnect: ((e: { device: HIDDeviceLike }) => void) | null = null

async function bindDevice(device: HIDDeviceLike): Promise<boolean> {
  if (_activeDevice) {
    try { await _activeDevice.close() } catch { /* ignore */ }
  }
  try {
    if (!device.opened) await device.open()
  } catch (err) {
    console.info('[HidInput] open failed:', err)
    return false
  }

  _onInputReport = (e: HIDInputReportEvent) => {
    const isPressed = anyByteNonZero(e.data)
    const wasPressed = _lastButtonsHash !== 0
    _lastButtonsHash = isPressed ? buttonsHash(e.data) : 0

    // Edge: 0 → non-zero is a press
    if (isPressed && !wasPressed) {
      fireNextAction()
    }
  }
  device.addEventListener('inputreport', _onInputReport)
  _activeDevice = device

  bus.emit('custom:hid:connected', {
    productName: device.productName,
    vendorId: device.vendorId,
    productId: device.productId,
  })
  return true
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Prompt the user for an HID device. The picker filters can be passed
 * to narrow the choice (e.g. `[{ vendorId: 0x0fd9 }]` for Elgato Stream
 * Deck), or left empty to allow any device.
 */
export async function connectHidDevice(
  filters: unknown[] = [],
): Promise<boolean> {
  const hid = getHid()
  if (!hid) return false
  try {
    const devices = await hid.requestDevice({ filters })
    const device = devices[0]
    if (!device) return false
    return await bindDevice(device)
  } catch (err) {
    console.info('[HidInput] requestDevice failed:', err)
    return false
  }
}

/** Release the active device, detach listeners. Idempotent. */
export async function disconnectHidDevice(): Promise<void> {
  if (!_activeDevice) return
  try {
    if (_onInputReport) _activeDevice.removeEventListener('inputreport', _onInputReport)
    await _activeDevice.close()
  } catch {
    // ignore
  }
  bus.emit('custom:hid:disconnected', {
    productName: _activeDevice.productName,
  })
  _activeDevice = null
  _onInputReport = null
  _lastButtonsHash = 0
  _cycleIdx = 0
}

/**
 * Auto-rebind the most recently paired device on app start. WebHID
 * remembers paired devices across sessions; getDevices() returns them
 * with `.opened === false` and we can re-open without a fresh prompt.
 *
 * Also subscribes to navigator.hid 'connect' so plugging the device
 * back in mid-session re-binds automatically.
 */
export async function startHidAutoBind(): Promise<void> {
  const hid = getHid()
  if (!hid) return

  // Try existing paired devices
  try {
    const devices = await hid.getDevices()
    // Pick the first one we can open. Most users pair one device.
    for (const d of devices) {
      const ok = await bindDevice(d)
      if (ok) break
    }
  } catch (err) {
    console.info('[HidInput] getDevices failed:', err)
  }

  // Listen for plug events
  _onConnect = (e) => {
    if (!_activeDevice) {
      void bindDevice(e.device)
    }
  }
  _onDisconnect = (e) => {
    if (_activeDevice && e.device === _activeDevice) {
      bus.emit('custom:hid:disconnected', {
        productName: _activeDevice.productName,
      })
      _activeDevice = null
      _onInputReport = null
      _lastButtonsHash = 0
    }
  }
  hid.addEventListener('connect', _onConnect)
  hid.addEventListener('disconnect', _onDisconnect)
}

/** Tear down auto-bind subscriptions + active device. */
export async function stopHidAutoBind(): Promise<void> {
  const hid = getHid()
  if (hid) {
    if (_onConnect) hid.removeEventListener('connect', _onConnect)
    if (_onDisconnect) hid.removeEventListener('disconnect', _onDisconnect)
  }
  _onConnect = null
  _onDisconnect = null
  await disconnectHidDevice()
}

export function isHidConnected(): boolean { return _activeDevice !== null }
export function getActiveHidName(): string | null {
  return _activeDevice?.productName ?? null
}
