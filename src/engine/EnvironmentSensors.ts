/**
 * EnvironmentSensors — Ambient light + idle detection
 *
 * Two complementary "environment awareness" pipelines:
 *
 *   1. AmbientLightSensor (Generic Sensor API)
 *      Reads ambient illuminance in lux from the device's light sensor
 *      (Android, ChromeOS, some Windows laptops) and exposes a normalized
 *      0..1 value as a CSS custom property + EventBus emission. Lets the
 *      portfolio dim its highlights when the user is in a dark room or
 *      lift them in bright daylight — the difference between "harsh
 *      strobing" and "comfortable glow" depending on environment.
 *
 *   2. IdleDetector (custom, EventListener-based)
 *      Watches mousemove/touch/keydown/wheel/pointerdown for activity.
 *      After `IDLE_THRESHOLD_MS` of silence emits `user:idle`, on the
 *      next activity emits `user:active`. Sets/removes `[data-idle]`
 *      on <body> so CSS can react (dim HUD, slow animations, kill
 *      cursor magnet). App-level subscribers pause ambient music and
 *      reduce GPGPU particle work to save battery.
 *
 * Why not the experimental browser-level Idle Detection API:
 *   • That API requires explicit permission + secure context, prompts
 *     the user mid-flow, and is gated to Chromium-only.
 *   • Our needs are "did the user stop interacting with THIS page" —
 *     not the OS-level idle (which is what the spec API measures).
 *   • A 20-line listener-based detector covers the use case without
 *     a permission prompt.
 *
 * Both pipelines are idempotent + HMR-safe and silently no-op on
 * unsupported platforms (Firefox/Safari/iOS for AmbientLightSensor;
 * server-side renders for both).
 */

import { bus } from './EventBus'

// ─── Idle threshold ──────────────────────────────────────────────────────────

const IDLE_THRESHOLD_MS = 30_000

// ─── AmbientLightSensor — capability + lifecycle ─────────────────────────────

/** True if the browser exposes the AmbientLightSensor constructor. */
export function isAmbientLightSupported(): boolean {
  return typeof window !== 'undefined' && 'AmbientLightSensor' in window
}

// Sensor instance lives at module scope so HMR doesn't accumulate them
type SensorLike = {
  start: () => void
  stop: () => void
  addEventListener: (k: string, fn: () => void) => void
  illuminance?: number
}
let _lightSensor: SensorLike | null = null
let _lastLux = 0
let _lastNorm = 0

/**
 * Map raw lux (0–10 000+ on bright daylight) to a perceptually useful
 * 0..1 normalization. Log curve because human contrast perception is
 * roughly logarithmic — a linear map would treat 200 lux (typical
 * desk light) and 10 000 lux (sunlight through window) as nearly the
 * same, which doesn't match how a recruiter perceives the screen.
 *
 * Pivot points after the curve:
 *   ~0   lux  → 0.00  (pitch dark)
 *   ~10  lux  → 0.20  (dim room, monitor-glow)
 *   ~200 lux  → 0.55  (typical office)
 *   ~1000 lux → 0.78  (bright office / overcast outside)
 *   ~10000+   → 1.00  (direct sunlight, capped)
 */
function normalizeLux(lux: number): number {
  if (lux <= 0) return 0
  // log10(lux) maps 1→0, 10→1, 100→2, 1000→3, 10000→4. Divide by 4 to
  // get 0..1 over the practical range, clamp at the ends.
  const v = Math.log10(lux + 1) / 4
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Start the ambient light pipeline. Permissions API is queried first;
 * if explicitly denied, we bail without instantiating the sensor.
 *
 * Idempotent — calling twice is a no-op until stop is called.
 */
export async function startAmbientLightSensor(): Promise<boolean> {
  if (!isAmbientLightSupported()) return false
  if (_lightSensor) return true

  // Probe permission state. The Permissions API for ambient-light-sensor
  // is itself behind a flag on some Chromium builds — wrap defensively.
  try {
    const perms = navigator.permissions
    if (perms?.query) {
      const status = await perms
        .query({ name: 'ambient-light-sensor' as PermissionName })
        .catch(() => null)
      if (status?.state === 'denied') {
        console.info('[EnvSensors] ambient-light permission denied')
        return false
      }
    }
  } catch {
    // permissions probe failed — proceed; constructor will throw if
    // truly blocked
  }

  try {
    // The Generic Sensor API isn't in lib.dom yet — cast through unknown.
    const Ctor = (window as unknown as {
      AmbientLightSensor: new (init: { frequency: number }) => SensorLike
    }).AmbientLightSensor
    _lightSensor = new Ctor({ frequency: 2 })

    _lightSensor.addEventListener('reading', () => {
      const lux = _lightSensor?.illuminance ?? 0
      const norm = normalizeLux(lux)
      _lastLux = lux
      _lastNorm = norm
      // Expose to CSS — let any token reference --ambient-lux to lift
      // or lower its glow without React state plumbing.
      document.documentElement.style.setProperty('--ambient-lux', norm.toFixed(3))
      bus.emit('env:lux', { lux, norm })
    })
    _lightSensor.addEventListener('error', () => {
      // Sensor failed mid-stream (device unplugged sensor, OS revoked).
      // Silent — the last value remains in the CSS var.
    })

    _lightSensor.start()
    return true
  } catch (err) {
    console.info('[EnvSensors] AmbientLightSensor failed:', err)
    _lightSensor = null
    return false
  }
}

/** Stop + tear down the ambient light pipeline. Safe to call any time. */
export function stopAmbientLightSensor(): void {
  if (!_lightSensor) return
  try { _lightSensor.stop() } catch { /* ignore */ }
  _lightSensor = null
}

/** Last reported illuminance in lux (0 if never read). */
export function getCurrentLux(): number { return _lastLux }
/** Last reported normalized 0..1 lux (0 if never read). */
export function getCurrentLuxNorm(): number { return _lastNorm }

// ─── IdleDetector — listener-based ───────────────────────────────────────────

const ACTIVITY_EVENTS: readonly (keyof WindowEventMap)[] = [
  'mousemove',
  'touchstart',
  'touchmove',
  'keydown',
  'wheel',
  'pointerdown',
]

let _idleTimer = 0
let _idleStarted = false
let _isIdle = false
let _idleThreshold = IDLE_THRESHOLD_MS

function _resetIdleTimer(): void {
  if (_isIdle) {
    _isIdle = false
    document.body.removeAttribute('data-idle')
    bus.emit('user:active')
  }
  if (_idleTimer) clearTimeout(_idleTimer)
  _idleTimer = window.setTimeout(() => {
    _isIdle = true
    document.body.setAttribute('data-idle', '')
    bus.emit('user:idle')
  }, _idleThreshold)
}

/**
 * Start the idle detector. Optional `thresholdMs` overrides the default
 * 30 seconds. Idempotent — calling twice updates the threshold without
 * double-binding listeners.
 */
export function startIdleDetector(thresholdMs: number = IDLE_THRESHOLD_MS): void {
  _idleThreshold = thresholdMs
  if (_idleStarted) {
    // Update threshold on next reset
    _resetIdleTimer()
    return
  }
  _idleStarted = true
  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, _resetIdleTimer, { passive: true, capture: true })
  }
  _resetIdleTimer()
}

/** Stop the idle detector + clear timer. */
export function stopIdleDetector(): void {
  if (!_idleStarted) return
  _idleStarted = false
  for (const evt of ACTIVITY_EVENTS) {
    window.removeEventListener(evt, _resetIdleTimer, { capture: true })
  }
  if (_idleTimer) {
    clearTimeout(_idleTimer)
    _idleTimer = 0
  }
  if (_isIdle) {
    _isIdle = false
    document.body.removeAttribute('data-idle')
  }
}

/** True if the user is currently idle past the threshold. */
export function isUserIdle(): boolean { return _isIdle }
