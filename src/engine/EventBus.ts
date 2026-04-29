/**
 * EventBus — Typed pub/sub magistrala za CORTEX Engine
 *
 * Centralna komunikacija izmedju svih sistema.
 * Nadmasuje IGT Postal.js: full TypeScript inference,
 * auto-cleanup, debug mode, wildcard subscribe.
 *
 * @example
 *   bus.on('splash:title:name', (p) => console.log(p))
 *   bus.emit('splash:title:name', { volume: 0.7 })
 *   bus.once('boot:complete', () => startSplash())
 */

// ─── Event Map (sve moguce event/payload kombinacije) ────────────────────────

export interface CortexEventMap {
  // Boot
  'boot:start': void
  'boot:progress': { percent: number; label: string }
  'boot:tap': void
  'boot:audio_unlocked': void
  'boot:unlock:burst': void
  'boot:complete': void
  'boot:fade_out': void

  // Splash
  'splash:start': void
  'splash:title:corners': void
  'splash:title:label': void
  'splash:title:name': void
  'splash:title:line': void
  'splash:title:button': void
  'splash:attract_loop': void
  'splash:enter': void

  // Transition
  'transition:splash_to_slot': void
  'transition:shockwave': void
  'transition:complete': void

  // Slot Genesis (machine assembling itself on first appearance)
  'slot:genesis:start': void
  'slot:genesis:tabs': void
  'slot:genesis:headers': void
  'slot:genesis:cells': { col: number }
  'slot:genesis:controls': void
  'slot:genesis:complete': void

  // Slot
  'slot:spin:start': void
  'slot:spin:stop': void
  'slot:reel:stop': { col: number; symbol?: string }
  'slot:reel:land': { col: number }
  'slot:section:change': { idx: number; name: string }
  'slot:win': { type: 'small' | 'medium' | 'big' | 'jackpot'; amount: number }
  'slot:item:select': { col: number; row: number }

  // Audio
  'audio:unlock': void
  'audio:play': { id: string; volume?: number; pan?: number }
  'audio:stop': { id: string }
  'audio:ambient:start': void
  'audio:ambient:stop': void
  'audio:mute': void
  'audio:unmute': void

  // System
  'debug:toggle': void
  'fps:drop': { fps: number }
  'fps:recover': void

  // Voice Control — handsfree commands (Web Speech API)
  // Subscribers in SlotMachine + audioStore translate these to actions.
  'voice:command:spin': void
  'voice:command:next': void
  'voice:command:back': void
  'voice:command:mute': void
  'voice:command:unmute': void
  'voice:command:jackpot': void

  // Catch-all for dynamic events
  [key: `custom:${string}`]: unknown
}

// ─── Types ───────────────────────────────────────────────────────────────────

type EventName = keyof CortexEventMap

type Handler<E extends EventName> = CortexEventMap[E] extends void
  ? () => void
  : (payload: CortexEventMap[E]) => void

interface Subscription {
  event: EventName
  handler: Handler<never>
  once: boolean
}

interface EventLogEntry {
  event: string
  payload: unknown
  timestamp: number
}

// ─── EventBus Class ──────────────────────────────────────────────────────────

class EventBusImpl {
  private _subs = new Map<string, Set<Subscription>>()
  private _log: EventLogEntry[] = []
  private _debug = false
  private _maxLog = 200

  /** Enable/disable debug logging to console */
  setDebug(on: boolean): void {
    this._debug = on
  }

  /** Subscribe to an event. Returns unsubscribe function. */
  on<E extends EventName>(event: E, handler: Handler<E>): () => void {
    return this._addSub(event, handler as Handler<never>, false)
  }

  /** Subscribe once — auto-removes after first fire. */
  once<E extends EventName>(event: E, handler: Handler<E>): () => void {
    return this._addSub(event, handler as Handler<never>, true)
  }

  /** Unsubscribe a specific handler. */
  off<E extends EventName>(event: E, handler: Handler<E>): void {
    const subs = this._subs.get(event)
    if (!subs) return
    for (const sub of subs) {
      if (sub.handler === handler) {
        subs.delete(sub)
        break
      }
    }
  }

  /** Emit an event. All registered handlers fire synchronously. */
  emit<E extends EventName>(
    event: E,
    ...args: CortexEventMap[E] extends void ? [] : [CortexEventMap[E]]
  ): void {
    const payload = args[0]

    // Log
    this._log.push({ event, payload, timestamp: performance.now() })
    if (this._log.length > this._maxLog) this._log.shift()

    if (this._debug) {
      console.log(
        `%c[EventBus] ${event}`,
        'color: #ffd700; font-weight: bold',
        payload ?? '',
      )
    }

    // Fire direct subscribers
    const subs = this._subs.get(event)
    if (subs) {
      for (const sub of [...subs]) {
        try {
          ;(sub.handler as (p?: unknown) => void)(payload)
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err)
        }
        if (sub.once) subs.delete(sub)
      }
    }

    // Fire wildcard subscribers (e.g. 'splash:*' matches 'splash:title:name')
    for (const [pattern, patSubs] of this._subs) {
      if (!pattern.endsWith(':*')) continue
      const prefix = pattern.slice(0, -1) // 'splash:'
      if (event.startsWith(prefix) && event !== pattern) {
        for (const sub of [...patSubs]) {
          try {
            ;(sub.handler as (p?: unknown) => void)(payload)
          } catch (err) {
            console.error(`[EventBus] Error in wildcard handler "${pattern}" for "${event}":`, err)
          }
          if (sub.once) patSubs.delete(sub)
        }
      }
    }
  }

  /** Get recent event log (for debug panel). */
  getLog(): readonly EventLogEntry[] {
    return this._log
  }

  /** Clear all subscriptions (for hot reload). */
  clear(): void {
    this._subs.clear()
    this._log = []
  }

  /** Get subscriber count for an event. */
  listenerCount(event: EventName): number {
    return this._subs.get(event)?.size ?? 0
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _addSub(event: string, handler: Handler<never>, once: boolean): () => void {
    if (!this._subs.has(event)) this._subs.set(event, new Set())
    const sub: Subscription = { event: event as EventName, handler, once }
    this._subs.get(event)!.add(sub)

    // Return unsubscribe
    return () => {
      this._subs.get(event)?.delete(sub)
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const bus = new EventBusImpl()

// Enable debug in dev mode
if (import.meta.env.DEV) {
  bus.setDebug(true)
  // Expose globally for console inspection
  ;(globalThis as Record<string, unknown>).__cortex_bus = bus
}
