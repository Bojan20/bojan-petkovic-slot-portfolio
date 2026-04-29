/**
 * HeartRate — WebBluetooth Heart Rate Service consumer
 *
 * Pairs with any BLE heart-rate monitor (Polar H10, Wahoo Tickr,
 * Apple Watch via paired sensor, Garmin chest strap, etc.) using the
 * standard 0x180D Heart Rate Service. The user's pulse drives a CSS
 * custom property `--heart-bpm` and a normalized `--heart-norm` (60
 * bpm = 0, 180 bpm = 1) at :root, which any visual layer can hook
 * for a literal "the portfolio breathes with you" effect.
 *
 * Why this matters as a portfolio piece:
 *   • WebBluetooth is Chromium-only, secure-context-only, and most
 *     devs never touch it. Demonstrating it pairs with the casino-
 *     theme aesthetic perfectly: the slot literally pumps to the
 *     user's heartbeat.
 *   • Standard GATT service number means it works with ANY consumer
 *     monitor — no device-specific code paths.
 *   • Real-time payload parsing of the HR Measurement characteristic
 *     covers both 8-bit and 16-bit value formats (the spec is bit-
 *     flag based).
 *
 * Event flow:
 *   navigator.bluetooth.requestDevice → device → server → service
 *   → characteristic → startNotifications → 'characteristicvaluechanged'
 *   → parse bpm → emit env:heart + update CSS vars
 *
 * Lifecycle:
 *   await connectHeartRateMonitor()    // user picks BLE device
 *   disconnectHeartRateMonitor()       // detach + GATT close
 *
 * No-op silently on Firefox / Safari (no navigator.bluetooth).
 * Requires HTTPS or localhost.
 */

import { bus } from './EventBus'

// ─── Capability detection ────────────────────────────────────────────────────

export function isHeartRateSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    typeof (navigator as Navigator & {
      bluetooth: { requestDevice: unknown }
    }).bluetooth?.requestDevice === 'function'
  )
}

// ─── Types — minimal shim for navigator.bluetooth ────────────────────────────

interface BluetoothCharLike {
  startNotifications: () => Promise<BluetoothCharLike>
  stopNotifications: () => Promise<BluetoothCharLike>
  addEventListener: (type: string, fn: (e: Event) => void) => void
  removeEventListener: (type: string, fn: (e: Event) => void) => void
  value: DataView | null
}

interface BluetoothServiceLike {
  getCharacteristic: (uuid: string | number) => Promise<BluetoothCharLike>
}

interface BluetoothServerLike {
  connected: boolean
  connect: () => Promise<BluetoothServerLike>
  disconnect: () => void
  getPrimaryService: (uuid: string | number) => Promise<BluetoothServiceLike>
}

interface BluetoothDeviceLike {
  name?: string
  gatt: BluetoothServerLike | null
  addEventListener: (type: string, fn: () => void) => void
  removeEventListener: (type: string, fn: () => void) => void
}

interface BluetoothLike {
  requestDevice: (opts: {
    filters?: Array<{ services?: Array<string | number> }>
    optionalServices?: Array<string | number>
    acceptAllDevices?: boolean
  }) => Promise<BluetoothDeviceLike>
}

function getBluetooth(): BluetoothLike | null {
  if (!isHeartRateSupported()) return null
  return (navigator as unknown as { bluetooth: BluetoothLike }).bluetooth
}

// ─── Heart Rate Measurement parser ───────────────────────────────────────────

/**
 * Parse the BLE Heart Rate Measurement characteristic payload.
 * Bit 0 of the flags byte: 0 = uint8 bpm, 1 = uint16 bpm.
 * Spec: https://www.bluetooth.com/specifications/specs/heart-rate-service-1-0/
 */
function parseHeartRate(view: DataView): number {
  if (view.byteLength === 0) return 0
  const flags = view.getUint8(0)
  const is16Bit = (flags & 0x01) === 0x01
  if (is16Bit) {
    if (view.byteLength < 3) return 0
    return view.getUint16(1, /* littleEndian */ true)
  }
  if (view.byteLength < 2) return 0
  return view.getUint8(1)
}

/**
 * Map raw bpm to a normalized 0..1 "exertion" value. 60 bpm (resting)
 * → 0, 180 bpm (peak cardio) → 1, clamped at the ends. This is the
 * value visual layers should react to — pure bpm doesn't normalize
 * across the room from people whose resting rates differ.
 */
function normalizeBpm(bpm: number): number {
  if (bpm <= 60) return 0
  if (bpm >= 180) return 1
  return (bpm - 60) / 120
}

// ─── State ───────────────────────────────────────────────────────────────────

let _device: BluetoothDeviceLike | null = null
let _server: BluetoothServerLike | null = null
let _characteristic: BluetoothCharLike | null = null
let _onValueChange: ((e: Event) => void) | null = null
let _onDisconnected: (() => void) | null = null
let _lastBpm = 0
let _lastNorm = 0

// HR Service / Measurement UUIDs are 16-bit allocations from the SIG
const HR_SERVICE = 0x180d
const HR_MEASUREMENT_CHAR = 0x2a37

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Prompt the user to pair a BLE heart-rate monitor. Resolves true on
 * successful subscription, false on cancel / unsupported / failure.
 */
export async function connectHeartRateMonitor(): Promise<boolean> {
  const bt = getBluetooth()
  if (!bt) return false

  let device: BluetoothDeviceLike
  try {
    device = await bt.requestDevice({
      filters: [{ services: [HR_SERVICE] }],
      // No optional services — we only need the HR service, anything
      // else is wasted attention surface in the picker.
    })
  } catch (err) {
    if ((err as DOMException)?.name === 'NotFoundError') return false
    console.info('[HeartRate] requestDevice failed:', err)
    return false
  }

  if (!device.gatt) {
    console.info('[HeartRate] device has no GATT — ignoring')
    return false
  }

  try {
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(HR_SERVICE)
    const characteristic = await service.getCharacteristic(HR_MEASUREMENT_CHAR)

    _onValueChange = (e) => {
      const target = (e as unknown as { target: BluetoothCharLike }).target
      const view = target?.value
      if (!view) return
      const bpm = parseHeartRate(view)
      if (bpm <= 0) return
      _lastBpm = bpm
      _lastNorm = normalizeBpm(bpm)
      document.documentElement.style.setProperty('--heart-bpm', String(bpm))
      document.documentElement.style.setProperty('--heart-norm', _lastNorm.toFixed(3))
      bus.emit('custom:heart', { bpm, norm: _lastNorm })
    }
    characteristic.addEventListener('characteristicvaluechanged', _onValueChange)
    await characteristic.startNotifications()

    _onDisconnected = () => {
      bus.emit('custom:heart:disconnected', null)
      _device = null
      _server = null
      _characteristic = null
    }
    device.addEventListener('gattserverdisconnected', _onDisconnected)

    _device = device
    _server = server
    _characteristic = characteristic
    bus.emit('custom:heart:connected', { name: device.name ?? 'Unknown HR Monitor' })
    return true
  } catch (err) {
    console.info('[HeartRate] subscribe failed:', err)
    return false
  }
}

export async function disconnectHeartRateMonitor(): Promise<void> {
  if (_characteristic && _onValueChange) {
    try {
      _characteristic.removeEventListener('characteristicvaluechanged', _onValueChange)
      await _characteristic.stopNotifications()
    } catch { /* ignore */ }
  }
  if (_device && _onDisconnected) {
    try { _device.removeEventListener('gattserverdisconnected', _onDisconnected) } catch { /* ignore */ }
  }
  if (_server?.connected) {
    try { _server.disconnect() } catch { /* ignore */ }
  }
  _device = null
  _server = null
  _characteristic = null
  _onValueChange = null
  _onDisconnected = null
  _lastBpm = 0
  _lastNorm = 0
  document.documentElement.style.removeProperty('--heart-bpm')
  document.documentElement.style.removeProperty('--heart-norm')
}

export function isHeartRateConnected(): boolean { return _characteristic !== null }
export function getCurrentBpm(): number { return _lastBpm }
export function getCurrentBpmNorm(): number { return _lastNorm }
