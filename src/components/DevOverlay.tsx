/**
 * DevOverlay — runtime metrics HUD unlocked via Konami code
 *
 * ↑↑↓↓←→←→BA toggles. Shows live FPS, frame ms, paint pressure, DOM
 * node count, JS heap, viewport+DPR, GSAP active animations, audio FFT
 * band bars, current app phase, and the last 10 EventBus events.
 *
 * Read pattern: refs (perfRef, audioLevelsRef) are mutated outside
 * React; this component runs its own RAF that copies the ref snapshot
 * into local state at ~6 fps display rate. That's a) fast enough to
 * read for a human and b) avoids 60fps React re-render churn that
 * would itself bias the FPS counter.
 */

import { useEffect, useRef, useState } from 'react'
import styles from './DevOverlay.module.css'
import { perfRef, startPerfMonitor } from '../engine/PerfMonitor'
import {
  audioLevelsRef,
  bus,
  connectHidDevice,
  connectSerialDevice,
  connectHeartRateMonitor,
  isWebHidSupported,
  isWebSerialSupported,
  isHeartRateSupported,
  isWebGPUSupported,
  isImageDecoderSupported,
  isOpfsSupported,
  isReelCaptureSupported,
  isAmbientLightSupported,
  isSpeechSynthSupported,
  isWebXrSupported,
  exportSnapshot,
  importSnapshot,
  startReelCapture,
  stopReelCapture,
  isReelCapturing,
} from '../engine'
import { useAudioStore } from '../store'

interface DevOverlayProps {
  visible: boolean
  onClose: () => void
  phase: string
}

interface UiSnapshot {
  fps: number
  frameMs: number
  domNodes: number
  memMb: number | null
  paints: number
  dpr: number
  vw: number
  vh: number
  anims: number
  bass: number
  mid: number
  treble: number
  events: Array<{ event: string; ts: number }>
}

/**
 * NearMissDisclosure — UX-honesty surface for P0.4.
 *
 * The slot machine biases ~25% of would-be jackpot landings to land
 * one cell off jackpot — the standard slot-research engagement
 * multiplier. Because this isn't gambling we can use the psychology,
 * but we disclose it openly here and let the recruiter disable it.
 */
function NearMissDisclosure() {
  const enabled = useAudioStore((s) => s.nearMissEnabled)
  const toggle = useAudioStore((s) => s.toggleNearMiss)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      <div style={{ fontSize: 10, lineHeight: 1.4, opacity: 0.75 }}>
        Anticipation: <b>ON</b>. Near-miss bias: <b>{enabled ? '25%' : 'OFF'}</b> on
        jackpot rows. Disclosed because this isn't gambling.
      </div>
      <button
        className={styles.btn}
        type="button"
        onClick={() => toggle()}
        style={{ alignSelf: 'flex-start', fontSize: 10, padding: '3px 9px' }}
      >
        {enabled ? 'DISABLE BIAS' : 'ENABLE BIAS'}
      </button>
    </div>
  )
}

export function DevOverlay({ visible, onClose, phase }: DevOverlayProps) {
  const [snap, setSnap] = useState<UiSnapshot | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const rafRef = useRef(0)
  const lastTickRef = useRef(0)

  // Boot perf collector when overlay first appears (cheap to leave on)
  useEffect(() => {
    if (visible) startPerfMonitor()
  }, [visible])

  useEffect(() => {
    if (!visible) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    const tick = (now: number) => {
      // Throttle UI updates to ~6fps so React doesn't bias the FPS sample
      if (now - lastTickRef.current >= 160) {
        lastTickRef.current = now
        const log = bus.getLog().slice(-10)
        setSnap({
          fps: perfRef.fps,
          frameMs: perfRef.frameMs,
          domNodes: perfRef.domNodes,
          memMb: perfRef.memMb,
          paints: perfRef.paints,
          dpr: perfRef.dpr,
          vw: perfRef.viewport.w,
          vh: perfRef.viewport.h,
          anims: perfRef.activeAnims,
          bass: audioLevelsRef.bass,
          mid: audioLevelsRef.mid,
          treble: audioLevelsRef.treble,
          events: log.map((e) => ({ event: e.event, ts: e.timestamp })),
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [visible])

  // ESC key closes
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onClose])

  if (!visible || !snap) return null

  // FPS color thresholds — green ≥55, amber 30–54, red <30
  const fpsClass =
    snap.fps >= 55 ? styles.valGood :
    snap.fps >= 30 ? styles.valWarn :
    styles.valBad

  // Paint pressure: green ≤2/s, amber 3–6/s, red ≥7/s
  const paintClass =
    snap.paints <= 2 ? styles.valGood :
    snap.paints <= 6 ? styles.valWarn :
    styles.valBad

  // Phase pill class
  const phasePillClass =
    phase === 'boot'     ? styles.phaseBoot :
    phase === 'splash'   ? styles.phaseSplash :
    phase === 'entering' ? styles.phaseEntering :
                           styles.phaseSlot

  if (collapsed) {
    return (
      <div className={`${styles.overlay} ${styles.overlayCollapsed}`} role="dialog" aria-label="Dev metrics (collapsed)">
        <div className={styles.collapsedRow} onClick={() => setCollapsed(false)}>
          <span className={styles.titleDot} />
          <span className={fpsClass}>{snap.fps} fps</span>
          <span className={styles.label}>·</span>
          <span>{snap.frameMs} ms</span>
          {snap.memMb != null && <>
            <span className={styles.label}>·</span>
            <span>{snap.memMb} MB</span>
          </>}
          <button
            className={styles.btn}
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            aria-label="Close dev overlay"
            title="Close (Esc) or Konami again"
          >×</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} role="dialog" aria-label="Dev metrics overlay">
      <header className={styles.header} onClick={() => setCollapsed(true)}>
        <span className={styles.title}>
          <span className={styles.titleDot} />
          CORTEX · DEV MODE
        </span>
        <span className={styles.btnGroup}>
          <button
            className={styles.btn}
            type="button"
            onClick={(e) => { e.stopPropagation(); setCollapsed(true) }}
            aria-label="Collapse"
            title="Collapse"
          >–</button>
          <button
            className={styles.btn}
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            aria-label="Close"
            title="Close (Esc)"
          >×</button>
        </span>
      </header>

      <div className={styles.body}>
        {/* ── Render section ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Render</div>
          <div className={styles.row}>
            <span className={styles.label}>FPS</span>
            <span className={`${styles.val} ${fpsClass}`}>{snap.fps}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Frame time</span>
            <span className={styles.val}>{snap.frameMs} ms</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Paints / sec</span>
            <span className={`${styles.val} ${paintClass}`}>{snap.paints}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>GSAP anims</span>
            <span className={styles.val}>{snap.anims}</span>
          </div>
        </div>

        {/* ── Memory section ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Memory · DOM</div>
          {snap.memMb != null && (
            <div className={styles.row}>
              <span className={styles.label}>JS heap</span>
              <span className={styles.val}>{snap.memMb} MB</span>
            </div>
          )}
          <div className={styles.row}>
            <span className={styles.label}>DOM nodes</span>
            <span className={styles.val}>{snap.domNodes}</span>
          </div>
        </div>

        {/* ── Viewport section ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Viewport</div>
          <div className={styles.row}>
            <span className={styles.label}>Size</span>
            <span className={styles.val}>{snap.vw} × {snap.vh}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>DPR</span>
            <span className={styles.val}>{snap.dpr}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Phase</span>
            <span className={styles.val}>
              <span className={`${styles.phase} ${phasePillClass}`}>{phase}</span>
            </span>
          </div>
        </div>

        {/* ── Audio FFT bands ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Audio (FFT)</div>
          <div className={styles.bands} aria-hidden="true">
            <div className={styles.bandWrap}>
              <div className={styles.bandBar} style={{ height: `${Math.round(snap.bass * 100)}%` }} />
              <div className={styles.bandLabel}>BASS</div>
            </div>
            <div className={styles.bandWrap}>
              <div className={styles.bandBar} style={{ height: `${Math.round(snap.mid * 100)}%` }} />
              <div className={styles.bandLabel}>MID</div>
            </div>
            <div className={styles.bandWrap}>
              <div className={styles.bandBar} style={{ height: `${Math.round(snap.treble * 100)}%` }} />
              <div className={styles.bandLabel}>TREB</div>
            </div>
          </div>
        </div>

        {/* ── Hardware bridges (Phase 16, 20, 21) ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Hardware</div>
          <div className={styles.hwRow}>
            <button
              className={styles.btn}
              type="button"
              disabled={!isWebHidSupported()}
              onClick={() => { void connectHidDevice([]) }}
              title={isWebHidSupported() ? 'Pair HID device (Stream Deck, X-keys, etc.)' : 'WebHID unsupported'}
            >HID</button>
            <button
              className={styles.btn}
              type="button"
              disabled={!isWebSerialSupported()}
              onClick={() => { void connectSerialDevice(9600) }}
              title={isWebSerialSupported() ? 'Pair USB-Serial Arduino lever' : 'WebSerial unsupported'}
            >SERIAL</button>
            <button
              className={styles.btn}
              type="button"
              disabled={!isHeartRateSupported()}
              onClick={() => { void connectHeartRateMonitor() }}
              title={isHeartRateSupported() ? 'Pair BLE heart-rate monitor' : 'WebBluetooth unsupported'}
            >HR ♥</button>
          </div>
        </div>

        {/* ── Session capture (Phase 14, 15) ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Session</div>
          <div className={styles.hwRow}>
            <button
              className={styles.btn}
              type="button"
              onClick={() => { void exportSnapshot() }}
              title="Export gzipped snapshot (Ctrl/Cmd+Shift+S)"
            >SNAP ↓</button>
            <button
              className={styles.btn}
              type="button"
              onClick={() => { void importSnapshot() }}
              title="Restore snapshot (Ctrl/Cmd+Shift+L)"
            >SNAP ↑</button>
            <button
              className={styles.btn}
              type="button"
              disabled={!isReelCaptureSupported()}
              onClick={() => {
                if (isReelCapturing()) void stopReelCapture()
                else void startReelCapture(null)
              }}
              title={isReelCaptureSupported() ? 'Toggle screen recording (Ctrl/Cmd+Shift+R)' : 'getDisplayMedia unsupported'}
            >● REEL</button>
          </div>
        </div>

        {/* ── Slot psychology disclosures (P0.4) ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Slot Psychology</div>
          <NearMissDisclosure />
        </div>

        {/* ── Capability matrix — what this browser supports ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Capabilities</div>
          <div className={styles.capGrid}>
            {([
              ['WebGPU',     isWebGPUSupported()],
              ['ImgDecoder', isImageDecoderSupported()],
              ['OPFS',       isOpfsSupported()],
              ['Reel cap',   isReelCaptureSupported()],
              ['AmbLight',   isAmbientLightSupported()],
              ['Speech',     isSpeechSynthSupported()],
              ['WebHID',     isWebHidSupported()],
              ['WebSerial',  isWebSerialSupported()],
              ['Bluetooth',  isHeartRateSupported()],
              ['WebXR',      isWebXrSupported()],
            ] as Array<[string, boolean]>).map(([name, ok]) => (
              <span
                key={name}
                className={`${styles.capPill} ${ok ? styles.capOk : styles.capNo}`}
                title={ok ? 'Supported on this browser' : 'Unsupported / disabled'}
              >
                {ok ? '✓' : '✕'} {name}
              </span>
            ))}
          </div>
        </div>

        {/* ── Event log ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>EventBus (last {snap.events.length})</div>
          <div className={styles.events}>
            {snap.events.length === 0 && (
              <div className={styles.eventRow}>
                <span className={styles.eventTime}>—</span>
                <span className={styles.eventName}>(no events yet)</span>
              </div>
            )}
            {snap.events.slice().reverse().map((ev, i) => (
              <div key={`${ev.ts}-${i}`} className={styles.eventRow}>
                <span className={styles.eventTime}>{(ev.ts / 1000).toFixed(2)}s</span>
                <span className={styles.eventName}>{ev.event}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DevOverlay
