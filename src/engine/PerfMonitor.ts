/**
 * PerfMonitor — live runtime metrics for the dev overlay
 *
 * Single shared singleton, writes to mutable refs that the overlay
 * reads each frame. Same zero-React pattern we use for parallaxRef and
 * audioLevelsRef — keeps overlay rendering at 60fps without React
 * re-render thrash.
 *
 * Tracked:
 *   • fps             rolling 1s average from RAF deltas
 *   • frameMs         smoothed frame time
 *   • domNodes        document.querySelectorAll('*').length sample (cheap)
 *   • memMb           performance.memory.usedJSHeapSize / 1MB (Chromium only)
 *   • paints          PerformanceObserver paint count last 1s
 *   • dpr             window.devicePixelRatio
 *   • viewport        { w, h }
 *   • activeAnims     gsap.globalTimeline.getChildren().length (best-effort)
 *
 * EventBus log is collected separately — bus.getLog() returns the last
 * N events; we just slice last 10 for display.
 */

import gsap from 'gsap'

export interface PerfSnapshot {
  fps: number
  frameMs: number
  domNodes: number
  memMb: number | null
  paints: number
  dpr: number
  viewport: { w: number; h: number }
  activeAnims: number
}

export const perfRef: PerfSnapshot = {
  fps: 0,
  frameMs: 0,
  domNodes: 0,
  memMb: null,
  paints: 0,
  dpr: 1,
  viewport: { w: 0, h: 0 },
  activeAnims: 0,
}

let rafId = 0
let lastFrameAt = 0
let frameCount = 0
let frameAccum = 0
let lastSecondAt = 0
let domSampleAt = 0
let paintObs: PerformanceObserver | null = null
let paintCountInWindow = 0
let lastPaintWindowAt = 0
let started = false

interface ChromiumMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}
interface ChromiumPerformance extends Performance {
  memory?: ChromiumMemory
}

/**
 * Start collecting perf metrics. Idempotent — calling twice is no-op.
 * Cheap to leave running (~0.1ms/frame), but disposeMonitor() stops
 * the RAF + paint observer cleanly.
 */
export function startPerfMonitor(): void {
  if (started) return
  started = true

  // PerformanceObserver for paint events — gives us paint pressure
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      paintObs = new PerformanceObserver((list) => {
        // Each entry = one Paint or FCP event
        paintCountInWindow += list.getEntries().length
      })
      paintObs.observe({ entryTypes: ['paint'] })
    } catch {
      // ignored — older browsers without paint entries
    }
  }

  perfRef.dpr = window.devicePixelRatio || 1
  perfRef.viewport = { w: window.innerWidth, h: window.innerHeight }

  const onResize = () => {
    perfRef.dpr = window.devicePixelRatio || 1
    perfRef.viewport = { w: window.innerWidth, h: window.innerHeight }
  }
  window.addEventListener('resize', onResize, { passive: true })

  lastFrameAt = performance.now()
  lastSecondAt = lastFrameAt
  lastPaintWindowAt = lastFrameAt

  const tick = () => {
    const now = performance.now()
    const delta = now - lastFrameAt
    lastFrameAt = now

    frameAccum += delta
    frameCount++

    // Rolling 1-second sample
    if (now - lastSecondAt >= 1000) {
      perfRef.fps = Math.round((frameCount * 1000) / (now - lastSecondAt))
      perfRef.frameMs = +(frameAccum / frameCount).toFixed(2)
      frameAccum = 0
      frameCount = 0
      lastSecondAt = now
    }

    // Paint pressure window (1s)
    if (now - lastPaintWindowAt >= 1000) {
      perfRef.paints = paintCountInWindow
      paintCountInWindow = 0
      lastPaintWindowAt = now
    }

    // DOM node count — cheap-ish (~0.5ms on this size of doc), so
    // sample only every 500ms.
    if (now - domSampleAt >= 500) {
      perfRef.domNodes = document.getElementsByTagName('*').length
      domSampleAt = now
    }

    // Chromium-only memory snapshot
    const chromePerf = performance as ChromiumPerformance
    if (chromePerf.memory) {
      perfRef.memMb = +(chromePerf.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)
    }

    // Active GSAP timeline count — best-effort
    try {
      perfRef.activeAnims = gsap.globalTimeline.getChildren(true, true, true).length
    } catch {
      perfRef.activeAnims = 0
    }

    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

export function disposePerfMonitor(): void {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
  paintObs?.disconnect()
  paintObs = null
  started = false
}
