/**
 * SerialInput — WebSerial Arduino / microcontroller lever input
 *
 * Pairs the portfolio with any USB-Serial device (Arduino, RP2040,
 * ESP32, FT232 cables) running a tiny line-protocol firmware. The
 * recruiter who has a custom slot lever wired to a board can pull it
 * physically and watch the reels fire.
 *
 * Why this matters as a portfolio piece:
 *   • WebSerial is Chromium-only modern API (Chrome 89+) most devs
 *     don't reach for — proves bleeding-edge platform tracking
 *   • Pairs naturally with the WebHID layer (Phase 16): HID for finished
 *     consumer devices, Serial for hacker / DIY hardware
 *   • Line-protocol parsing keeps firmware dead simple — Arduino
 *     `Serial.println("PULL")` is the entire integration on the device
 *
 * Wire protocol (one ASCII line per event, \n terminated):
 *   PULL              → slot:spin:start          (lever pulled down)
 *   RELEASE           → slot:spin:stop           (lever released back)
 *   BTN <n>           → round-robin action cycle (any button)
 *   POT <n> <0-1023>  → master volume (n=0) or sfx (n=1) (0..1023 raw)
 *
 * Lifecycle:
 *   await connectSerialDevice()  // user picks port via native picker
 *   startSerialAutoBind()        // re-bind already-permitted ports
 *   disconnectSerialDevice()     // close + release
 *
 * No-op silently on Firefox / Safari (no navigator.serial). Works on
 * Chromium desktop + Android via WebUSB-backed implementation.
 */

import { bus } from './EventBus'
import { useAudioStore } from '../store'

// ─── Capability detection ────────────────────────────────────────────────────

export function isWebSerialSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serial' in navigator &&
    typeof (navigator as Navigator & {
      serial: { requestPort: unknown }
    }).serial?.requestPort === 'function'
  )
}

// ─── Types — minimal shim for navigator.serial (lib.dom partial) ─────────────

interface SerialPortLike {
  open: (opts: { baudRate: number }) => Promise<void>
  close: () => Promise<void>
  readable: ReadableStream<Uint8Array> | null
  getInfo: () => { usbVendorId?: number; usbProductId?: number }
}

interface SerialLike {
  requestPort: (opts?: { filters?: unknown[] }) => Promise<SerialPortLike>
  getPorts: () => Promise<SerialPortLike[]>
  addEventListener: (type: string, fn: (e: { port: SerialPortLike }) => void) => void
  removeEventListener: (type: string, fn: (e: { port: SerialPortLike }) => void) => void
}

function getSerial(): SerialLike | null {
  if (!isWebSerialSupported()) return null
  return (navigator as unknown as { serial: SerialLike }).serial
}

// ─── Round-robin button cycle (mirrors HidInput) ─────────────────────────────

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

function fireRotated(): void {
  const action = ACTION_CYCLE[_cycleIdx % ACTION_CYCLE.length]
  switch (action) {
    case 'slot:spin:start':       bus.emit('slot:spin:start');       break
    case 'voice:command:next':    bus.emit('voice:command:next');    break
    case 'voice:command:back':    bus.emit('voice:command:back');    break
    case 'voice:command:jackpot': bus.emit('voice:command:jackpot'); break
  }
  _cycleIdx = (_cycleIdx + 1) % ACTION_CYCLE.length
}

// ─── Line protocol parser ────────────────────────────────────────────────────

function handleLine(line: string): void {
  const trimmed = line.trim()
  if (!trimmed) return

  // PULL — lever down → spin
  if (trimmed === 'PULL') {
    bus.emit('slot:spin:start')
    return
  }
  // RELEASE — lever up → stop signal (slot machine handles spin termination)
  if (trimmed === 'RELEASE') {
    bus.emit('slot:spin:stop')
    return
  }

  // BTN <n> — any button → round-robin action
  if (trimmed.startsWith('BTN ')) {
    fireRotated()
    return
  }

  // POT <channel> <raw 0-1023> — analog pot → volume
  if (trimmed.startsWith('POT ')) {
    const parts = trimmed.split(/\s+/)
    const ch = Number(parts[1])
    const raw = Number(parts[2])
    if (!Number.isFinite(ch) || !Number.isFinite(raw)) return
    const norm = Math.max(0, Math.min(1, raw / 1023))
    const audio = useAudioStore.getState()
    if (ch === 0) audio.setMasterVolume(norm)
    else if (ch === 1) audio.setSfxVolume(norm)
    return
  }

  // Unknown — log at info, don't reject (firmware iteration friendly)
  console.info('[SerialInput] unknown line:', trimmed)
}

// ─── Active port + reader loop ───────────────────────────────────────────────

let _activePort: SerialPortLike | null = null
let _reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let _readLoopActive = false
let _onConnect: ((e: { port: SerialPortLike }) => void) | null = null
let _onDisconnect: ((e: { port: SerialPortLike }) => void) | null = null

async function readLoop(port: SerialPortLike): Promise<void> {
  const stream = port.readable
  if (!stream) return
  const decoder = new TextDecoder()
  let buffer = ''
  _reader = stream.getReader()
  _readLoopActive = true

  try {
    while (_readLoopActive) {
      const { value, done } = await _reader.read()
      if (done) break
      if (!value) continue
      buffer += decoder.decode(value, { stream: true })
      // Split on \n and dispatch complete lines; keep partial in buffer
      let nl = buffer.indexOf('\n')
      while (nl !== -1) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        handleLine(line)
        nl = buffer.indexOf('\n')
      }
    }
  } catch (err) {
    if (_readLoopActive) {
      console.info('[SerialInput] read loop error:', err)
    }
  } finally {
    _readLoopActive = false
    try { _reader?.releaseLock() } catch { /* ignore */ }
    _reader = null
  }
}

async function bindPort(port: SerialPortLike, baudRate: number): Promise<boolean> {
  if (_activePort) {
    try {
      _readLoopActive = false
      await _reader?.cancel().catch(() => {})
      await _activePort.close()
    } catch { /* ignore */ }
  }
  try {
    await port.open({ baudRate })
  } catch (err) {
    console.info('[SerialInput] open failed:', err)
    return false
  }
  _activePort = port
  void readLoop(port).catch(() => {})

  const info = port.getInfo()
  bus.emit('custom:serial:connected', {
    vendorId: info.usbVendorId ?? 0,
    productId: info.usbProductId ?? 0,
    baudRate,
  })
  return true
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Prompt the user for a serial port. Default 9600 baud (Arduino classic). */
export async function connectSerialDevice(baudRate = 9600): Promise<boolean> {
  const serial = getSerial()
  if (!serial) return false
  try {
    const port = await serial.requestPort()
    return await bindPort(port, baudRate)
  } catch (err) {
    if ((err as DOMException)?.name === 'NotFoundError') return false
    console.info('[SerialInput] requestPort failed:', err)
    return false
  }
}

export async function disconnectSerialDevice(): Promise<void> {
  if (!_activePort) return
  _readLoopActive = false
  try { await _reader?.cancel().catch(() => {}) } catch { /* ignore */ }
  try { await _activePort.close() } catch { /* ignore */ }
  bus.emit('custom:serial:disconnected', null)
  _activePort = null
  _reader = null
  _cycleIdx = 0
}

/**
 * Re-bind any port the user previously authorized. Like WebHID, the
 * platform remembers permission grants across sessions; getPorts()
 * returns them and we can open without a fresh prompt.
 */
export async function startSerialAutoBind(baudRate = 9600): Promise<void> {
  const serial = getSerial()
  if (!serial) return

  try {
    const ports = await serial.getPorts()
    for (const p of ports) {
      const ok = await bindPort(p, baudRate)
      if (ok) break
    }
  } catch (err) {
    console.info('[SerialInput] getPorts failed:', err)
  }

  _onConnect = (e) => {
    if (!_activePort) {
      void bindPort(e.port, baudRate)
    }
  }
  _onDisconnect = (e) => {
    if (_activePort && e.port === _activePort) {
      void disconnectSerialDevice()
    }
  }
  serial.addEventListener('connect', _onConnect)
  serial.addEventListener('disconnect', _onDisconnect)
}

export async function stopSerialAutoBind(): Promise<void> {
  const serial = getSerial()
  if (serial) {
    if (_onConnect) serial.removeEventListener('connect', _onConnect)
    if (_onDisconnect) serial.removeEventListener('disconnect', _onDisconnect)
  }
  _onConnect = null
  _onDisconnect = null
  await disconnectSerialDevice()
}

export function isSerialConnected(): boolean { return _activePort !== null }
