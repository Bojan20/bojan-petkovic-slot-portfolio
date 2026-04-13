/**
 * Sequencer — Deklarativni command executor za CORTEX Engine
 *
 * IGT-inspired, ali bolji:
 * - TypeScript generics
 * - Cancellable u bilo kom momentu
 * - JSON-driven (čita SequenceConfig)
 * - Async/await based (ne callback hell)
 *
 * @example
 *   const seq = new Sequencer(bus)
 *   await seq.run(splashSequenceConfig)  // runs all steps in order
 *   seq.cancel()                          // abort at any point
 */

import { bus } from './EventBus'
import type { SequenceConfig } from './config/configTypes'

export class Sequencer {
  private _running = false
  private _cancelled = false
  private _currentStep = -1
  private _timers: number[] = []

  /** Is the sequencer currently executing a sequence? */
  get isRunning(): boolean {
    return this._running
  }

  /** Current step index (-1 if not running) */
  get currentStep(): number {
    return this._currentStep
  }

  /**
   * Run a sequence config. Emits events on the EventBus at configured delays.
   * Returns a promise that resolves when all steps are complete.
   */
  async run(config: SequenceConfig): Promise<void> {
    if (this._running) {
      console.warn(`[Sequencer] Already running, cancelling previous sequence`)
      this.cancel()
    }

    this._running = true
    this._cancelled = false
    this._currentStep = -1

    console.log(`[Sequencer] Starting "${config.name}" (${config.steps.length} steps)`)

    for (let i = 0; i < config.steps.length; i++) {
      if (this._cancelled) break

      const step = config.steps[i]!
      this._currentStep = i

      // Wait for step delay
      if (step.delay && step.delay > 0) {
        await this._wait(step.delay)
        if (this._cancelled) break
      }

      // Emit the event
      bus.emit(step.event as 'splash:title:corners')

      // Wait for step duration (if specified, allows animations to complete)
      if (step.duration && step.duration > 0) {
        await this._wait(step.duration)
        if (this._cancelled) break
      }
    }

    this._running = false
    this._currentStep = -1

    if (!this._cancelled) {
      console.log(`[Sequencer] "${config.name}" completed`)
    }
  }

  /** Cancel the current sequence */
  cancel(): void {
    this._cancelled = true
    this._running = false
    this._currentStep = -1
    this._timers.forEach((id) => clearTimeout(id))
    this._timers = []
  }

  /** Dispose — cancel and cleanup */
  dispose(): void {
    this.cancel()
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const id = window.setTimeout(resolve, ms)
      this._timers.push(id)
    })
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const sequencer = new Sequencer()
