/**
 * PlatformPolish — four platform-aware UX upgrades that "just feel right"
 *
 * 1. Wake Lock — keep the screen on while portfolio is in foreground
 *    (recruiter shows it to a colleague without the phone going dark
 *    every 30 seconds). Auto-released when tab loses visibility.
 *
 * 2. Page Visibility — pause the ambient music + RAF visual loops when
 *    the tab is backgrounded, restore when it comes back. Saves CPU
 *    and battery, and keeps the music from playing in a hidden tab.
 *
 * 3. Web Share — native OS share sheet ("Share this portfolio" →
 *    iMessage, WhatsApp, Mail, Signal) where supported.
 *
 * 4. Adaptive Quality — Battery + Network Information APIs combined
 *    into a single LITE_MODE flag exposed via subscribeQualityMode().
 *    Visual layers can read this and pre-emptively scale down before
 *    the user's phone starts thermal-throttling.
 *
 * All four APIs are gracefully degraded — every call is a no-op on
 * unsupported browsers, never throws, never spams console.
 */

import { bus } from './EventBus'

// ─────────────────────────────────────────────────────────────────────
// 1. WAKE LOCK
// ─────────────────────────────────────────────────────────────────────
// W3C Wake Lock API (chrome.com/articles/wake-lock/). Available on
// Chrome 84+, Edge 84+, Samsung Internet 14+, Safari 16.4+. NOT on
// Firefox. Permission-free as long as the document is visible.
//
// Lifecycle: request when audio first unlocks (boot:tap is the canonical
// "user is engaging" moment). Browser auto-releases on visibility change;
// we re-request when the tab becomes visible again so the recruiter
// switching apps and back doesn't lose the lock.

// WakeLock types ship in lib.dom (TS 5+). We just guard for runtime
// presence — Firefox doesn't ship the API even though TS knows the type.
let wakeLock: WakeLockSentinel | null = null
let wakeLockEnabled = false

function getWakeLockApi(): WakeLock | null {
  const n = navigator as Navigator & { wakeLock?: WakeLock }
  return n.wakeLock ?? null
}

async function requestWakeLock(): Promise<void> {
  const api = getWakeLockApi()
  if (!api || !wakeLockEnabled || document.visibilityState !== 'visible') return
  if (wakeLock && !wakeLock.released) return
  try {
    wakeLock = await api.request('screen')
    wakeLock.addEventListener('release', () => {
      // Browser released — typically due to visibility change. Will be
      // re-requested by the visibility handler if conditions are right.
      wakeLock = null
    })
  } catch {
    // Common: NotAllowedError if the document isn't visible at the
    // exact moment of request. Silently ignore — visibility handler
    // will retry next time the tab is brought back.
  }
}

export function enableWakeLock(): void {
  wakeLockEnabled = true
  void requestWakeLock()
}

export function disableWakeLock(): void {
  wakeLockEnabled = false
  if (wakeLock && !wakeLock.released) {
    void wakeLock.release()
  }
  wakeLock = null
}

// ─────────────────────────────────────────────────────────────────────
// 2. PAGE VISIBILITY
// ─────────────────────────────────────────────────────────────────────
// Single shared visibility listener that:
//  • pauses an audio element when hidden, resumes when visible
//  • re-acquires wake lock when visible
//  • emits a 'system:visibility' bus event for any other consumer
//    (visual RAF loops can short-circuit themselves on hidden)

let visibilityCleanup: (() => void) | null = null
let pausedAudios: HTMLAudioElement[] = []

export function registerAudioForVisibilityPause(audio: HTMLAudioElement): () => void {
  pausedAudios.push(audio)
  return () => {
    pausedAudios = pausedAudios.filter((a) => a !== audio)
  }
}

/** True if the document is currently visible. Cheap to call any time. */
export function isPageVisible(): boolean {
  return typeof document === 'undefined' ? true : document.visibilityState === 'visible'
}

export function startPageVisibilityHandler(): void {
  if (visibilityCleanup) return
  let wasPlayingByAudio = new WeakMap<HTMLAudioElement, boolean>()

  const handler = () => {
    const visible = isPageVisible()
    if (visible) {
      // Resume previously-playing audios
      for (const a of pausedAudios) {
        if (wasPlayingByAudio.get(a)) {
          a.play().catch(() => { /* ignore — autoplay may still be locked */ })
        }
      }
      // Re-acquire wake lock if we want it
      if (wakeLockEnabled) void requestWakeLock()
    } else {
      // Going hidden — remember play state, then pause
      for (const a of pausedAudios) {
        const playing = !a.paused && !a.ended
        wasPlayingByAudio.set(a, playing)
        if (playing) a.pause()
      }
    }
    bus.emit('custom:visibility' as 'custom:visibility', { visible })
  }
  document.addEventListener('visibilitychange', handler)
  visibilityCleanup = () => {
    document.removeEventListener('visibilitychange', handler)
  }
}

export function stopPageVisibilityHandler(): void {
  visibilityCleanup?.()
  visibilityCleanup = null
}

// ─────────────────────────────────────────────────────────────────────
// 3. WEB SHARE
// ─────────────────────────────────────────────────────────────────────
// navigator.share — opens the native OS share sheet. iOS 12.2+,
// Android Chrome 75+, Edge. Falls back to copy-to-clipboard on
// unsupported browsers (or returns false to let the caller decide
// whether to surface their own fallback UI).

export interface ShareOptions {
  title: string
  text: string
  url: string
}

export function isWebShareSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Open the native share sheet. Returns true on success (or copy
 * fallback success), false if the user cancelled or it failed.
 */
export async function sharePortfolio(opts: ShareOptions): Promise<boolean> {
  if (isWebShareSupported()) {
    try {
      await navigator.share(opts)
      return true
    } catch (e) {
      // AbortError = user cancelled — not a failure, just return false.
      // Other errors fall through to clipboard fallback below.
      const name = (e as Error)?.name
      if (name === 'AbortError') return false
    }
  }
  // Fallback: copy URL to clipboard if available
  try {
    await navigator.clipboard?.writeText(opts.url)
    return true
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. ADAPTIVE QUALITY
// ─────────────────────────────────────────────────────────────────────
// Combine Battery API + Network Information API into a single boolean
// LITE_MODE flag. Subscribers can listen for changes; visual layers
// pre-emptively scale down (drop shader octaves, kill scanlines,
// halve particle count) before the device starts thermal-throttling.
//
// Triggers LITE on:
//   • Battery level < 20% AND not charging
//   • Network effectiveType === 'slow-2g' or '2g'
//   • Network saveData === true (user explicitly opted into data-saver)

export type QualityMode = 'full' | 'lite'

interface BatteryManager extends EventTarget {
  charging: boolean
  level: number
  addEventListener(type: 'levelchange' | 'chargingchange', cb: () => void): void
}
interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>
}
interface NetworkInformation extends EventTarget {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g'
  saveData: boolean
  addEventListener(type: 'change', cb: () => void): void
}
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation
}

let qualityMode: QualityMode = 'full'
const qualityListeners = new Set<(m: QualityMode) => void>()

export function getQualityMode(): QualityMode {
  return qualityMode
}

export function subscribeQualityMode(fn: (m: QualityMode) => void): () => void {
  qualityListeners.add(fn)
  fn(qualityMode)
  return () => { qualityListeners.delete(fn) }
}

function setQualityMode(m: QualityMode): void {
  if (m === qualityMode) return
  qualityMode = m
  qualityListeners.forEach((fn) => { try { fn(m) } catch { /* ignore */ } })
  bus.emit('custom:quality' as 'custom:quality', { mode: m })
}

export async function startAdaptiveQuality(): Promise<void> {
  const computeMode = async (): Promise<QualityMode> => {
    // Network check — saveData OR slow connection forces lite
    const c = (navigator as NavigatorWithConnection).connection
    if (c?.saveData) return 'lite'
    if (c && (c.effectiveType === 'slow-2g' || c.effectiveType === '2g')) return 'lite'

    // Battery check — <20% AND not charging
    try {
      const getBat = (navigator as NavigatorWithBattery).getBattery
      if (getBat) {
        const bat = await getBat()
        if (bat.level < 0.20 && !bat.charging) return 'lite'
      }
    } catch { /* ignore — not all browsers expose */ }

    return 'full'
  }

  const recompute = async () => {
    const m = await computeMode()
    setQualityMode(m)
  }

  // Initial check
  await recompute()

  // Subscribe to network changes
  const c = (navigator as NavigatorWithConnection).connection
  c?.addEventListener('change', () => { void recompute() })

  // Subscribe to battery changes
  try {
    const getBat = (navigator as NavigatorWithBattery).getBattery
    if (getBat) {
      const bat = await getBat()
      bat.addEventListener('levelchange', () => { void recompute() })
      bat.addEventListener('chargingchange', () => { void recompute() })
    }
  } catch { /* ignore */ }
}
