/**
 * MidiInput — Web MIDI API integration
 *
 * Plug in any MIDI keyboard (or virtual MIDI device — IAC bus on macOS,
 * loopMIDI on Windows) and play the slot. Recruiters from sound-design
 * studios often have MIDI gear within reach; when they tap a key and
 * the reels respond, that's a memorable moment.
 *
 * Mapping — keep it intuitive for a sound designer:
 *   ╭─ MIDI note ───────── action ───────────────────────────╮
 *   │ C3 (48)  → spin                                        │
 *   │ D3 (50)  → next section                                │
 *   │ E3 (52)  → previous section                            │
 *   │ F3 (53)  → next item (reel down)                       │
 *   │ G3 (55)  → previous item (reel up)                     │
 *   │ A3 (57)  → mute toggle                                 │
 *   │ B3 (59)  → trigger jackpot easter egg                  │
 *   │ C4 (60)..B4 → playable casino SFX (procedural ping     │
 *   │              with pitch from MIDI note, velocity =     │
 *   │              volume, pan = (note-66)/12 left↔right)   │
 *   │ Pitch wheel → cursor magnet field x-axis (parallax)    │
 *   │ Mod wheel  → cursor magnet field y-axis                │
 *   ╰────────────────────────────────────────────────────────╯
 *
 * Browser support: Chrome / Edge / Opera (full MIDI + sysex). Safari +
 * Firefox NOT supported (Mozilla scrapped it). On unsupported browsers,
 * every call is a silent no-op.
 *
 * Privacy: navigator.requestMIDIAccess prompts the user once. We pass
 * { sysex: false } so no system-exclusive messages are exchanged —
 * lowest possible permission scope.
 */

import { bus } from './EventBus'
import { getSfxGain } from './SoundManager'

export const midiStateRef = {
  connected: false,
  inputName: '' as string,
}

// TS5 ships MIDIAccess / MIDIInput / MIDIMessageEvent in lib.dom.
// We just feature-detect requestMIDIAccess at runtime — Firefox/Safari
// don't expose it even though TypeScript knows the type signature.

// Track wheel state — pitch wheel value 0..16383 (centered at 8192)
let pitchWheel = 8192
let modWheel = 0

// Stick-cursor writer hook (set externally by BootScreen; same pattern
// as GamepadInput so the stick + wheels both feed the same lerp tick).
let cursorWriter: ((x: number, y: number) => void) | null = null
export function setMidiCursorWriter(fn: (x: number, y: number) => void): void {
  cursorWriter = fn
}

let midiAccess: MIDIAccess | null = null
let started = false

export function isWebMidiSupported(): boolean {
  return typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { requestMIDIAccess?: unknown }).requestMIDIAccess === 'function'
}

/**
 * Request MIDI access + start listening. Browser prompts user for
 * permission on first call. Returns true if access was granted.
 */
export async function startMidiInput(): Promise<boolean> {
  if (started) return true
  if (!isWebMidiSupported()) return false

  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false })
  } catch (err) {
    console.info('[MIDI] permission denied or unavailable:', err)
    return false
  }
  started = true

  // Wire all currently-connected inputs
  for (const input of midiAccess.inputs.values()) {
    wireInput(input)
  }

  // React to plug/unplug events
  midiAccess.onstatechange = (e) => {
    const port = e.port
    if (!port) return
    if (port.state === 'connected') {
      // The state-change input might be either an input or output;
      // re-walk inputs to find it (safer than casting).
      for (const inp of midiAccess!.inputs.values()) {
        if (inp.name === port.name) {
          wireInput(inp)
          break
        }
      }
    } else {
      // Disconnected — refresh state
      const remaining = Array.from(midiAccess!.inputs.values()).filter(
        (i) => i.state === 'connected',
      )
      if (remaining.length === 0) {
        midiStateRef.connected = false
        midiStateRef.inputName = ''
        bus.emit('custom:midi' as 'custom:midi', { connected: false, name: '' })
      } else {
        midiStateRef.inputName = remaining[0]!.name ?? 'MIDI'
      }
    }
  }

  return true
}

function wireInput(input: MIDIInput): void {
  midiStateRef.connected = true
  midiStateRef.inputName = input.name ?? 'MIDI'
  bus.emit('custom:midi' as 'custom:midi', { connected: true, name: midiStateRef.inputName })

  input.onmidimessage = (e) => {
    if (e.data) handleMidiMessage(e.data)
  }
}

// ── MIDI message handler ────────────────────────────────────────────
//
// MIDI status bytes:
//   0x90..0x9F = Note On  (channel 0..15)
//   0x80..0x8F = Note Off
//   0xB0..0xBF = Control Change (CC)
//   0xE0..0xEF = Pitch Bend
function handleMidiMessage(data: Uint8Array): void {
  if (!data || data.length < 1) return
  const status = data[0]!
  const type = status & 0xF0

  if (type === 0x90) {
    // Note On — but velocity 0 is treated as Note Off by spec
    const note = data[1] ?? 0
    const velocity = data[2] ?? 0
    if (velocity === 0) return
    onNoteOn(note, velocity)
    return
  }
  if (type === 0xB0) {
    // Control Change
    const cc = data[1] ?? 0
    const value = data[2] ?? 0
    onControlChange(cc, value)
    return
  }
  if (type === 0xE0) {
    // Pitch Bend — 14-bit value across two bytes (lsb, msb)
    const lsb = data[1] ?? 0
    const msb = data[2] ?? 0
    pitchWheel = (msb << 7) | lsb
    updateCursorFromWheels()
    return
  }
}

// Map of "function" notes (the 7 control keys at the bottom octave)
const FN_NOTES: Record<number, () => void> = {
  48: () => bus.emit('voice:command:spin'),
  50: () => bus.emit('voice:command:next'),
  52: () => bus.emit('voice:command:back'),
  53: () => bus.emit('custom:item_next' as 'custom:item_next', {}),
  55: () => bus.emit('custom:item_prev' as 'custom:item_prev', {}),
  57: () => bus.emit('custom:mute_toggle' as 'custom:mute_toggle', {}),
  59: () => bus.emit('voice:command:jackpot'),
}

function onNoteOn(note: number, velocity: number): void {
  // Function key path
  const fn = FN_NOTES[note]
  if (fn) {
    fn()
    return
  }
  // Playable casino SFX zone (C4..B4 and beyond) — procedural ping with
  // pitch from MIDI note. Velocity → volume. Pan from (note-66)/12.
  if (note >= 60) {
    playMidiPing(note, velocity)
  }
}

function onControlChange(cc: number, value: number): void {
  // CC 1 = Mod wheel (0..127). Map to cursor Y-axis (0..1).
  if (cc === 1) {
    modWheel = value
    updateCursorFromWheels()
  }
  // CC 64 = Sustain pedal — spin while pressed (sound designers love
  // pedals; lets them just-tap to spin while playing notes with hands).
  if (cc === 64 && value >= 64) {
    bus.emit('voice:command:spin')
  }
}

function updateCursorFromWheels(): void {
  if (!cursorWriter) return
  // pitchWheel: 0..16383 centered at 8192 → -1..+1 → 0..1
  const px = pitchWheel / 16383
  // modWheel: 0..127 → 0..1, but invert so up = top (musicians push up
  // for "up" in mod = our visual y is flipped)
  const my = 1 - modWheel / 127
  cursorWriter(px, my)
}

/**
 * Procedural casino-style ping: short triangle wave + filtered noise.
 * Note → frequency via standard MIDI formula (A4 = note 69 = 440Hz).
 * Velocity (1..127) → output volume (logarithmic-ish).
 * Pan derived from note position so a chord plays as a stereo spread.
 */
function playMidiPing(note: number, velocity: number): void {
  const out = (() => { try { return getSfxGain() } catch { return null } })()
  if (!out) return
  const ac = out.context as AudioContext
  if (ac.state !== 'running') return

  const now = ac.currentTime
  const freq = 440 * Math.pow(2, (note - 69) / 12)
  const vel = Math.max(0.05, Math.min(1, velocity / 127))
  const pan = Math.max(-1, Math.min(1, (note - 66) / 12))

  // Triangle pitch body
  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)
  // Very subtle pitch dip to give the ping a "casino click" feel
  osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.18)

  const g = ac.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.20 * vel, now + 0.005)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

  const panner = ac.createStereoPanner()
  panner.pan.value = pan

  osc.connect(g).connect(panner).connect(out)
  osc.start(now)
  osc.stop(now + 0.24)
}

export function stopMidiInput(): void {
  if (midiAccess) {
    for (const input of midiAccess.inputs.values()) {
      input.onmidimessage = null
    }
    midiAccess.onstatechange = null
  }
  midiAccess = null
  midiStateRef.connected = false
  midiStateRef.inputName = ''
  cursorWriter = null
  started = false
}
