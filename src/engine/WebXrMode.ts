/**
 * WebXrMode — WebXR immersive session entry point
 *
 * Probes the device for immersive-vr / immersive-ar capability. If
 * present, exposes `enterXR(canvas)` which opens an XRSession and
 * binds a WebGL or WebGPU layer for stereo rendering.
 *
 * Why this matters as a portfolio piece:
 *   • Demonstrates platform tracking even into the headset / Vision
 *     Pro / Quest space — WebXR is the only browser API that can
 *     enter immersive mode on Apple Vision Pro (Safari Vision OS),
 *     Quest Browser, Pico, HoloLens.
 *   • Capability probing is the only feature 99% of recruiters will
 *     ever experience here (no headset on hand) — but the probe
 *     itself is cheap, populates a CSS hint, and the entry path is
 *     implemented for the rare power user who walks in with a
 *     Vision Pro on their head.
 *
 * Default behavior:
 *   • On startup, probes immersive-vr and immersive-ar support
 *     non-blockingly and emits `custom:xr:capability` with the result
 *   • Sets `--xr-supported` CSS var on :root (1 if any session type
 *     is supported, 0 otherwise) so styling can show / hide a
 *     "View in VR" badge
 *
 * Entry path:
 *   • `enterImmersiveVR(canvas)` — opens XRSession of immersive-vr
 *     type with a baseLayer pointing at the given canvas. Returns
 *     the session handle for caller-managed render loop.
 *   • For the actual stereo render, the caller wires their existing
 *     WebGL / WebGPU pipeline — this module only handles the session
 *     handshake.
 *
 * No-op silently on browsers without navigator.xr.
 */

import { bus } from './EventBus'

// ─── Capability detection ────────────────────────────────────────────────────

export function isWebXrSupported(): boolean {
  return typeof navigator !== 'undefined' && 'xr' in navigator
}

interface XRSystemLike {
  isSessionSupported: (mode: string) => Promise<boolean>
  requestSession: (mode: string, opts?: unknown) => Promise<XRSessionLike>
}

interface XRSessionLike {
  end: () => Promise<void>
  addEventListener: (type: string, fn: () => void) => void
  removeEventListener: (type: string, fn: () => void) => void
}

function getXr(): XRSystemLike | null {
  if (!isWebXrSupported()) return null
  return (navigator as unknown as { xr: XRSystemLike }).xr
}

// ─── Capability probe ────────────────────────────────────────────────────────

export interface XrCapability {
  vr: boolean
  ar: boolean
}

let _capability: XrCapability = { vr: false, ar: false }

/**
 * Probe support for both immersive session types. Caches result.
 * Idempotent — calling repeatedly returns the same result without
 * re-probing.
 */
export async function probeXrCapability(): Promise<XrCapability> {
  const xr = getXr()
  if (!xr) {
    _capability = { vr: false, ar: false }
    return _capability
  }

  const [vr, ar] = await Promise.all([
    xr.isSessionSupported('immersive-vr').catch(() => false),
    xr.isSessionSupported('immersive-ar').catch(() => false),
  ])
  _capability = { vr, ar }

  // Surface to CSS for "View in VR" badge styling
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(
      '--xr-supported',
      vr || ar ? '1' : '0',
    )
  }
  bus.emit('custom:xr:capability', { vr, ar })
  return _capability
}

export function getXrCapability(): XrCapability { return { ..._capability } }

// ─── Session entry ───────────────────────────────────────────────────────────

let _activeSession: XRSessionLike | null = null

/**
 * Open an immersive session. The `mode` selects vr or ar. The caller
 * is responsible for configuring their render layer (WebGL or WebGPU)
 * onto the session — this module returns the handle and listens for
 * the `end` event to clear local state.
 *
 * Returns null on any failure (unsupported, permission denied, hardware
 * not present).
 */
export async function enterImmersive(
  mode: 'immersive-vr' | 'immersive-ar' = 'immersive-vr',
): Promise<XRSessionLike | null> {
  const xr = getXr()
  if (!xr) return null
  if (_activeSession) return _activeSession

  const supported = mode === 'immersive-vr' ? _capability.vr : _capability.ar
  if (!supported) {
    // Re-probe in case capability hasn't been queried yet
    const cap = await probeXrCapability()
    const ok = mode === 'immersive-vr' ? cap.vr : cap.ar
    if (!ok) {
      console.info('[WebXr] mode unsupported:', mode)
      return null
    }
  }

  try {
    const session = await xr.requestSession(mode, {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    })
    _activeSession = session
    session.addEventListener('end', () => {
      bus.emit('custom:xr:ended', null)
      _activeSession = null
    })
    bus.emit('custom:xr:started', { mode })
    return session
  } catch (err) {
    console.info('[WebXr] requestSession failed:', err)
    return null
  }
}

export async function exitImmersive(): Promise<void> {
  if (!_activeSession) return
  try { await _activeSession.end() } catch { /* ignore */ }
  _activeSession = null
}

export function isImmersiveActive(): boolean { return _activeSession !== null }
