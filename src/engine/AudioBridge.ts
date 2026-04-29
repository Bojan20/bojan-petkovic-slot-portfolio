/**
 * AudioBridge — WebSocket client za CORTEX Audio Manager
 *
 * Povezuje portfolio sa standalone Audio Manager-om (Electron).
 * Audio Manager šalje assign/unassign/preview poruke sa base64 audio data.
 * Portfolio prima, kešira zvuk i pušta ga kad se hook triggeruje.
 *
 * Protocol (ws://localhost:9800):
 *   Manager → Portfolio:
 *     { type: 'assign',   hookId, soundId, dataUrl }
 *     { type: 'unassign', hookId }
 *     { type: 'preview',  hookId }
 *     { type: 'hooks',    hooks: [...] }
 *     { type: 'mappings', mappings: {...} }
 *
 *   Portfolio → Manager:
 *     { type: 'status', connected: true }
 */

import { bus } from './EventBus'
import { opfsWrite, opfsRead, opfsDelete, opfsList } from './OpfsCache'

const WS_URL = 'ws://localhost:9800'
const RECONNECT_INTERVAL_BASE = 3000
/** Cap exponential backoff at 30s so we don't reach hour-long delays
 *  if the user leaves the tab open with no manager running. The
 *  onerror handler is silenced (eats the default browser console
 *  noise) since Audio Manager not running is a normal recruiter
 *  scenario, not an error worth surfacing. */
const MAX_BACKOFF_MS = 30_000

// ─── State ───────────────────────────────────────────────────────────────────

let _ws: WebSocket | null = null
let _connected = false
let _reconnectTimer: number | null = null
/** Count of consecutive failed attempts. Reset to 0 on successful
 *  connect. Drives exponential backoff + silent-mode threshold. */
let _failedAttempts = 0

/** Hook → cached Audio element */
const _audioCache = new Map<string, HTMLAudioElement>()

// ─── OPFS persistence ────────────────────────────────────────────────────────
//
// Audio Manager sends base64 dataUrl payloads over WS. Without persistence
// the recruiter loses every assignment on refresh — a fresh page-load
// has to wait for the WS reconnect before any portfolio sound fires.
// We mirror every assign into OPFS under `bridge/<hookId>` (raw blob,
// no base64 padding) and replay them all on init() before WS even
// opens, so a returning visitor has the full assignment table loaded
// instantly + offline.

const BRIDGE_OPFS_DIR = 'bridge'

/** Decode a data URL into a Blob — extract MIME + base64 body. */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!m) return null
  const mime = m[1]!
  const b64 = m[2]!
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

/** Persist an assignment to OPFS. Fire-and-forget. */
function persistAssign(hookId: string, dataUrl: string): void {
  const blob = dataUrlToBlob(dataUrl)
  if (!blob) return
  void opfsWrite(`${BRIDGE_OPFS_DIR}/${hookId}`, blob).catch(() => {})
}

/** Remove an assignment from OPFS. Fire-and-forget. */
function unpersistAssign(hookId: string): void {
  void opfsDelete(`${BRIDGE_OPFS_DIR}/${hookId}`).catch(() => {})
}

/**
 * On init, replay all persisted assignments into the in-memory cache.
 * Runs before WS connect so the next user gesture (boot tap) already
 * has the full sound palette wired. WS later overwrites with fresher
 * assignments if the Audio Manager has updated mappings.
 */
async function rehydrateFromOpfs(): Promise<number> {
  const entries = await opfsList(BRIDGE_OPFS_DIR)
  let loaded = 0
  for (const hookId of entries) {
    const blob = await opfsRead(`${BRIDGE_OPFS_DIR}/${hookId}`)
    if (!blob) continue
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.preload = 'auto'
    _audioCache.set(hookId, audio)
    loaded++
  }
  if (loaded > 0) {
    wireEvents()
    console.log(`[AudioBridge] Rehydrated ${loaded} assignments from OPFS`)
  }
  return loaded
}

/** Hook ID → EventBus event name mapping */
const HOOK_TO_EVENT: Record<string, string> = {
  // ── Boot Lifecycle ──
  'bootStart':        'boot:start',
  'bootProgress':     'boot:progress',
  'bootTap':          'boot:tap',
  'bootAudioUnlock':  'boot:audio_unlocked',
  'bootComplete':     'boot:complete',
  'bootFadeOut':      'boot:fade_out',

  // ── Splash Animations ──
  'splashStart':      'splash:start',
  'introWhoosh':      'splash:title:corners',
  'whoosh':           'splash:title:label',
  'reveal':           'splash:title:name',
  'swoosh':           'splash:title:line',
  'click':            'splash:title:button',
  'attractLoop':      'splash:attract_loop',
  'splashEnter':      'splash:enter',

  // ── Transition ──
  'transitionStart':  'transition:splash_to_slot',
  'transitionEnd':    'transition:complete',

  // ── Slot Machine ──
  'reelSpin':         'slot:spin:start',
  'spinMech':         'slot:spin:start',
  'leverPull':        'slot:spin:start',
  'leverRelease':     'slot:spin:stop',
  'reelStop':         'slot:reel:stop',
  'reelLand':         'slot:reel:land',
  'sectionChange':    'slot:section:change',
  'win':              'slot:win',
  'jackpot':          'slot:win',
  'itemSelect':       'slot:item:select',

  // ── Audio Control ──
  'audioUnlock':      'audio:unlock',
  'audioPlay':        'audio:play',
  'audioStop':        'audio:stop',
  'ambientStart':     'audio:ambient:start',
  'ambientStop':      'audio:ambient:stop',
  'mute':             'audio:mute',
  'unmute':           'audio:unmute',

  // ── UI Sounds ──
  'tick':             'audio:play',
  'select':           'audio:play',
  'back':             'audio:play',
  'uiOpen':           'audio:play',
  'uiClose':          'audio:play',

  // ── System ──
  'debugToggle':      'debug:toggle',
  'fpsDrop':          'fps:drop',
  'fpsRecover':       'fps:recover',
}

// Reverse: EventBus event → hook IDs
const EVENT_TO_HOOKS = new Map<string, string[]>()
for (const [hookId, eventName] of Object.entries(HOOK_TO_EVENT)) {
  const existing = EVENT_TO_HOOKS.get(eventName) ?? []
  existing.push(hookId)
  EVENT_TO_HOOKS.set(eventName, existing)
}

// ─── Audio playback ──────────────────────────────────────────────────────────

function playHook(hookId: string): void {
  const audio = _audioCache.get(hookId)
  if (!audio) return

  // Clone + play for overlapping
  const clone = audio.cloneNode() as HTMLAudioElement
  clone.volume = audio.volume
  clone.play().catch(() => {})
}

// ─── EventBus integration ────────────────────────────────────────────────────

const _eventCleanups: (() => void)[] = []

function wireEvents(): void {
  // Unwire previous
  _eventCleanups.forEach(fn => fn())
  _eventCleanups.length = 0

  // For each cached hook, listen for corresponding EventBus events
  for (const [hookId] of _audioCache) {
    const eventName = HOOK_TO_EVENT[hookId]
    if (!eventName) continue

    // Subscribe to EventBus — when event fires, play the assigned sound
    const unsub = bus.on(eventName as 'splash:title:corners', () => {
      playHook(hookId)
    })
    _eventCleanups.push(unsub)
  }

  console.log(`[AudioBridge] Wired ${_eventCleanups.length} hook→event listeners`)
}

// ─── WebSocket connection ────────────────────────────────────────────────────

function handleMessage(data: string): void {
  try {
    const msg = JSON.parse(data)

    switch (msg.type) {
      case 'assign': {
        // Received base64 audio data from Audio Manager
        const audio = new Audio(msg.dataUrl)
        audio.preload = 'auto'
        _audioCache.set(msg.hookId, audio)
        // Persist to OPFS so the assignment survives refresh + works
        // offline next time. Fire-and-forget — non-blocking.
        persistAssign(msg.hookId, msg.dataUrl)
        wireEvents()
        console.log(`[AudioBridge] Assigned "${msg.soundId}" → hook "${msg.hookId}"`)
        break
      }

      case 'unassign': {
        _audioCache.delete(msg.hookId)
        unpersistAssign(msg.hookId)
        wireEvents()
        console.log(`[AudioBridge] Unassigned hook "${msg.hookId}"`)
        break
      }

      case 'preview': {
        // Audio Manager wants to preview a hook — play it now
        playHook(msg.hookId)
        console.log(`[AudioBridge] Preview hook "${msg.hookId}"`)
        break
      }

      case 'mappings': {
        // Bulk mappings on connect — we don't have audio data yet,
        // Audio Manager needs to re-send assigns
        console.log(`[AudioBridge] Received ${Object.keys(msg.mappings).length} hook mappings`)
        break
      }

      case 'hooks': {
        console.log(`[AudioBridge] Received ${msg.hooks.length} available hooks`)
        break
      }
    }
  } catch (err) {
    console.error('[AudioBridge] Parse error:', err)
  }
}

function connect(): void {
  if (_ws) return

  try {
    // Suppress the browser's default 'WebSocket connection failed'
    // console error by attaching an empty error handler BEFORE the
    // socket starts negotiating. The browser still logs the network
    // tab entry, but the JS console stays quiet — recruiter doesn't
    // see "WebSocket failed" red text just because Audio Manager
    // isn't running locally.
    _ws = new WebSocket(WS_URL)

    _ws.onopen = () => {
      _connected = true
      _failedAttempts = 0
      console.log('[AudioBridge] Connected to Audio Manager')
      _ws!.send(JSON.stringify({ type: 'status', connected: true }))
    }

    _ws.onmessage = (ev) => {
      handleMessage(ev.data as string)
    }

    _ws.onclose = () => {
      _ws = null
      _connected = false
      _failedAttempts += 1
      scheduleReconnect()
    }

    _ws.onerror = () => {
      // Intentionally empty — the close handler runs immediately
      // after onerror and is the canonical place for reconnect logic.
      // Eating onerror prevents the browser's default uncaught-error
      // console message.
    }
  } catch {
    _failedAttempts += 1
    scheduleReconnect()
  }
}

function scheduleReconnect(): void {
  if (_reconnectTimer) return
  // Exponential backoff capped at MAX_BACKOFF_MS — cushions long
  // tab idle without a running Audio Manager.
  const backoff = Math.min(
    RECONNECT_INTERVAL_BASE * Math.pow(1.6, Math.min(_failedAttempts - 1, 8)),
    MAX_BACKOFF_MS,
  )
  _reconnectTimer = window.setTimeout(() => {
    _reconnectTimer = null
    connect()
  }, backoff)
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function isAudioBridgeConnected(): boolean {
  return _connected
}

export function getAssignedHooks(): string[] {
  return [..._audioCache.keys()]
}

/** Initialize bridge — call once on app mount */
let _initLogged = false
export function initAudioBridge(): void {
  // Rehydrate persisted assignments from OPFS first so the first
  // event after mount can fire its assigned sound even before WS
  // reconnect — critical for "open portfolio offline, hear all the
  // sounds anyway" UX. Non-blocking; WS connect runs in parallel.
  void rehydrateFromOpfs().catch(() => {})
  connect()
  if (!_initLogged) {
    _initLogged = true
    console.log('[AudioBridge] Initialized, connecting to ws://localhost:9800...')
  }
}

/** Disconnect and cleanup */
export function disposeAudioBridge(): void {
  if (_reconnectTimer) clearTimeout(_reconnectTimer)
  _reconnectTimer = null
  _eventCleanups.forEach(fn => fn())
  _eventCleanups.length = 0
  _audioCache.clear()
  if (_ws) {
    _ws.close()
    _ws = null
  }
  _connected = false
}
