/**
 * ComputePressure — adaptive quality gate driven by system load.
 *
 * navigator.computePressure (Chrome 125+, Edge 125+, ChromeOS) reports
 * CPU pressure on a 4-step scale: nominal | fair | serious | critical.
 * We surface the level as a CSS custom property on :root and emit a
 * `custom:perf:pressure` event so consumers (WebGPUCompute, motion-
 * heavy CSS layers) can degrade gracefully under thermal/battery
 * stress without waiting for FPS to drop.
 *
 * Why this matters: existing adaptive quality (Phase 6.3) only watches
 * battery and saveData. Compute Pressure is the only API that sees
 * what's actually happening on the CPU — when a recruiter has 47
 * Chrome tabs open and an Electron app, the portfolio knows to pull
 * back BEFORE the user sees jank.
 *
 * No-op silently on browsers without the API. Permissions: none —
 * the reading is non-invasive (no individual frequency data, just
 * the bucket).
 */

import { bus } from './EventBus'

export type PressureLevel = 'nominal' | 'fair' | 'serious' | 'critical'

interface PressureRecordLike {
  state: PressureLevel
  source: string
  time: number
}

interface PressureObserverLike {
  observe: (source: 'cpu', opts?: { sampleInterval?: number }) => Promise<void>
  disconnect: () => void
}

interface PressureObserverCtor {
  new (callback: (records: PressureRecordLike[]) => void): PressureObserverLike
  knownSources: readonly string[]
}

// ─── Capability detection ────────────────────────────────────────────────────

export function isComputePressureSupported(): boolean {
  return typeof window !== 'undefined' && 'PressureObserver' in window
}

// ─── State ───────────────────────────────────────────────────────────────────

let _observer: PressureObserverLike | null = null
let _lastLevel: PressureLevel = 'nominal'
/** StrictMode safety — incremented on each start/stop pair so the
 *  async `observe()` resolution can detect that the start it belongs
 *  to has already been torn down and self-cancel without surfacing
 *  AbortError to the console. */
let _generation = 0

/** Map a level to a 0..1 numeric load suitable for shader uniforms. */
function levelToLoad(level: PressureLevel): number {
  switch (level) {
    case 'nominal':  return 0.0
    case 'fair':     return 0.33
    case 'serious':  return 0.66
    case 'critical': return 1.0
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Begin observing CPU pressure. Idempotent — calling repeatedly is a
 * no-op until stopComputePressure(). Sample interval defaults to 1000ms
 * which is generous enough to never itself cost a frame.
 *
 * Returns true if observer was started, false if unsupported.
 */
export async function startComputePressure(sampleInterval = 1000): Promise<boolean> {
  if (!isComputePressureSupported()) return false
  if (_observer) return true

  // Capture the generation that THIS start call belongs to. If the
  // generation changes (caller stops + restarts) while observe()
  // resolves, we know the active call has been torn down and
  // self-cancel cleanly — no AbortError leaks.
  const myGen = ++_generation

  let observer: PressureObserverLike
  try {
    const Ctor = (window as unknown as { PressureObserver: PressureObserverCtor }).PressureObserver
    observer = new Ctor((records) => {
      // Drop late records that arrive after a tear-down.
      if (myGen !== _generation) return
      const last = records[records.length - 1]
      if (!last) return
      if (last.state === _lastLevel) return
      _lastLevel = last.state
      document.documentElement.style.setProperty(
        '--perf-pressure',
        levelToLoad(last.state).toFixed(2),
      )
      document.documentElement.style.setProperty(
        '--perf-pressure-level',
        `"${last.state}"`,
      )
      bus.emit('custom:perf:pressure', {
        level: last.state,
        load: levelToLoad(last.state),
      })
    })
  } catch (err) {
    console.info('[ComputePressure] construct failed:', err)
    return false
  }

  try {
    await observer.observe('cpu', { sampleInterval })
    // After await: if our generation is stale, the caller already
    // stopped us. Disconnect the orphan observer and bail silently.
    if (myGen !== _generation) {
      try { observer.disconnect() } catch { /* ignore */ }
      return false
    }
    _observer = observer
    return true
  } catch (err) {
    // AbortError under StrictMode double-mount: caller stopped us
    // mid-await. Silent — the new start will succeed.
    const name = (err as DOMException)?.name
    if (name === 'AbortError' || name === 'NotAllowedError') {
      try { observer.disconnect() } catch { /* ignore */ }
      return false
    }
    console.info('[ComputePressure] observe failed:', err)
    try { observer.disconnect() } catch { /* ignore */ }
    return false
  }
}

/** Stop observing + clear CSS vars. */
export function stopComputePressure(): void {
  // Bump generation so any in-flight observe() promise self-cancels
  // when it resolves.
  _generation++
  if (!_observer) return
  try { _observer.disconnect() } catch { /* ignore */ }
  _observer = null
  _lastLevel = 'nominal'
  if (typeof document !== 'undefined') {
    document.documentElement.style.removeProperty('--perf-pressure')
    document.documentElement.style.removeProperty('--perf-pressure-level')
  }
}

/** Read the most recent pressure level. */
export function getCurrentPressure(): PressureLevel { return _lastLevel }

/** Read the last level mapped to 0..1. */
export function getCurrentPressureLoad(): number { return levelToLoad(_lastLevel) }
