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

const WS_URL = 'ws://localhost:9800'
const RECONNECT_INTERVAL = 3000

// ─── State ───────────────────────────────────────────────────────────────────

let _ws: WebSocket | null = null
let _connected = false
let _reconnectTimer: number | null = null

/** Hook → cached Audio element */
const _audioCache = new Map<string, HTMLAudioElement>()

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
        wireEvents()
        console.log(`[AudioBridge] Assigned "${msg.soundId}" → hook "${msg.hookId}"`)
        break
      }

      case 'unassign': {
        _audioCache.delete(msg.hookId)
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
    _ws = new WebSocket(WS_URL)

    _ws.onopen = () => {
      _connected = true
      console.log('[AudioBridge] Connected to Audio Manager')
      _ws!.send(JSON.stringify({ type: 'status', connected: true }))
    }

    _ws.onmessage = (ev) => {
      handleMessage(ev.data as string)
    }

    _ws.onclose = () => {
      _ws = null
      _connected = false
      scheduleReconnect()
    }

    _ws.onerror = () => {
      _ws?.close()
    }
  } catch {
    scheduleReconnect()
  }
}

function scheduleReconnect(): void {
  if (_reconnectTimer) return
  _reconnectTimer = window.setTimeout(() => {
    _reconnectTimer = null
    connect()
  }, RECONNECT_INTERVAL)
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function isAudioBridgeConnected(): boolean {
  return _connected
}

export function getAssignedHooks(): string[] {
  return [..._audioCache.keys()]
}

/** Initialize bridge — call once on app mount */
export function initAudioBridge(): void {
  connect()
  console.log('[AudioBridge] Initialized, connecting to ws://localhost:9800...')
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
