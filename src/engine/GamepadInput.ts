/**
 * GamepadInput — Xbox / PlayStation / Switch / generic HID controllers
 *
 * Standard Gamepad API mapping (Chrome, Edge, Safari 16+, Samsung
 * Internet 19+, Firefox 89+). Controllers connect via Bluetooth or
 * USB. The API is fully native — zero npm deps, zero permission
 * prompts. We poll on a RAF tick (the API doesn't push events).
 *
 * Mapped controls for the slot machine:
 *   ╭─ button ──── action ───────────────────────────────╮
 *   │ A / Cross / B-button       → spin                  │
 *   │ B / Circle / A-button      → mute toggle           │
 *   │ D-pad left / RB shoulder   → previous section      │
 *   │ D-pad right / LB shoulder  → next section          │
 *   │ D-pad up                   → previous item (reel up)│
 *   │ D-pad down                 → next item (reel down) │
 *   │ Start / Options            → toggle dev overlay    │
 *   │ Left stick                 → parallax cursor       │
 *   │   (mapped to (mx, my) like mouse — affects boot 7) │
 *   ╰────────────────────────────────────────────────────╯
 *
 * Why integrate at all: it's a free easy "wow" — many recruiters at
 * casino studios have controllers nearby (or use them daily for
 * gameplay). When they realize the portfolio responds to their
 * controller, that's a signal moment.
 *
 * State is exposed via gamepadConnectedRef so the UI can show a small
 * indicator when a controller is detected.
 */

import { bus } from './EventBus'

export const gamepadStateRef = {
  /** True if at least one gamepad is currently connected */
  connected: false,
  /** Name of the first connected gamepad (for UI display) */
  name: '' as string,
  /** Left stick (-1..1) — drives parallax cursor */
  leftX: 0,
  leftY: 0,
}

let rafId = 0
let started = false
let prevButtons: boolean[] = []
let stickWriter: ((x: number, y: number) => void) | null = null

interface ConnectionEvent extends Event {
  gamepad: Gamepad
}

/**
 * Provide a callback that receives left-stick values mapped to
 * normalized parallax space (0..1). Lets the cursor magnet field
 * be steered with the stick on top of mouse/gyro/touch.
 */
export function setStickCursorWriter(fn: (mx: number, my: number) => void): void {
  stickWriter = fn
}

const DEAD_ZONE = 0.16

/** Standard mapping button indices (most controllers expose this) */
const BTN = {
  A: 0,           // Cross / B (Switch)
  B: 1,           // Circle / A (Switch)
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  // 6/7 are triggers
  // 8 = back/select/share
  START: 9,       // Options / + / Menu
  // 10/11 = stick clicks
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const

export function startGamepadInput(): void {
  if (started) return
  if (typeof window === 'undefined' || typeof navigator.getGamepads !== 'function') return
  started = true

  const onConn = (e: Event) => {
    const ce = e as ConnectionEvent
    gamepadStateRef.connected = true
    gamepadStateRef.name = ce.gamepad.id
    bus.emit('custom:gamepad' as 'custom:gamepad', { connected: true, name: ce.gamepad.id })
  }
  const onDisc = (e: Event) => {
    const ce = e as ConnectionEvent
    // Check if any other gamepad is still active
    const pads = (navigator.getGamepads() || []).filter(Boolean) as Gamepad[]
    const others = pads.filter((g) => g.index !== ce.gamepad.index)
    if (others.length === 0) {
      gamepadStateRef.connected = false
      gamepadStateRef.name = ''
      bus.emit('custom:gamepad' as 'custom:gamepad', { connected: false, name: '' })
    } else {
      gamepadStateRef.name = others[0]!.id
    }
  }
  window.addEventListener('gamepadconnected', onConn)
  window.addEventListener('gamepaddisconnected', onDisc)

  const tick = () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    let active: Gamepad | null = null
    for (const p of pads) {
      if (p) { active = p; break }
    }

    if (active) {
      gamepadStateRef.connected = true
      gamepadStateRef.name = active.id

      // ── Buttons (rising-edge detect) ─────────────────────────────
      const btns = active.buttons.map((b) => b.pressed)
      const wasPressed = (i: number) => !prevButtons[i] && btns[i]

      if (wasPressed(BTN.A))          bus.emit('voice:command:spin')
      if (wasPressed(BTN.B))          {
        // Toggle mute by emitting both — handlers read current state.
        // Simpler: emit a custom toggle and let App.tsx handle it.
        bus.emit('custom:mute_toggle' as 'custom:mute_toggle', {})
      }
      if (wasPressed(BTN.DPAD_RIGHT) || wasPressed(BTN.RB)) bus.emit('voice:command:next')
      if (wasPressed(BTN.DPAD_LEFT)  || wasPressed(BTN.LB)) bus.emit('voice:command:back')
      if (wasPressed(BTN.DPAD_UP))    bus.emit('custom:item_prev' as 'custom:item_prev', {})
      if (wasPressed(BTN.DPAD_DOWN))  bus.emit('custom:item_next' as 'custom:item_next', {})
      if (wasPressed(BTN.START))      bus.emit('debug:toggle')

      prevButtons = btns

      // ── Left stick → parallax cursor ─────────────────────────────
      const ax = active.axes[0] ?? 0
      const ay = active.axes[1] ?? 0
      const lx = Math.abs(ax) > DEAD_ZONE ? ax : 0
      const ly = Math.abs(ay) > DEAD_ZONE ? ay : 0
      gamepadStateRef.leftX = lx
      gamepadStateRef.leftY = ly
      if ((lx !== 0 || ly !== 0) && stickWriter) {
        // Map -1..1 → 0..1 then write
        stickWriter(0.5 + lx * 0.5, 0.5 + ly * 0.5)
      }
    }

    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

export function stopGamepadInput(): void {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
  started = false
  prevButtons = []
  stickWriter = null
  gamepadStateRef.connected = false
  gamepadStateRef.name = ''
}
