/**
 * PlatformChip — top-right corner pills for platform features
 *
 * Two surfaces:
 *  • SHARE chip: tappable, opens native OS share sheet (or copies URL
 *    fallback). Always shown — works on desktop too via clipboard.
 *  • LITE-MODE badge: shown ONLY when adaptive quality has dropped to
 *    'lite' (low battery / slow network / saveData). Read-only badge,
 *    confirms to the user that the visuals are auto-tuning down.
 *
 * Hidden during the boot phase so it doesn't compete with the
 * Lucky 7 hero moment. Fades in from splash onward.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './PlatformChip.module.css'
import {
  isWebShareSupported,
  sharePortfolio,
  subscribeQualityMode,
  gamepadStateRef,
  isWebMidiSupported,
  startMidiInput,
  midiStateRef,
  isDocumentPipSupported,
  openPipWindow,
  closePipWindow,
  onPipWindowClosed,
  type QualityMode,
} from '../engine'
import { activatePendingUpdate, isUpdateAvailable } from '../sw-register'
import { bus } from '../engine'
import { PipCard } from './PipCard'

interface PlatformChipsProps {
  /** Hide entirely during boot — Lucky 7 hero owns the screen there. */
  visible: boolean
}

const SHARE_OPTS = {
  title: 'Bojan Petković — Sound Designer & Game Audio Engineer',
  text: 'Take a look — slot machine portfolio with reactive audio, voice control, and a casino feel.',
  url: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
}

export function PlatformChips({ visible }: PlatformChipsProps) {
  const [mode, setMode] = useState<QualityMode>('full')
  const [toast, setToast] = useState<string | null>(null)
  const [toastKey, setToastKey] = useState(0)
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [updateReady, setUpdateReady] = useState(() => isUpdateAvailable())
  const [gamepadName, setGamepadName] = useState<string>('')
  const [midiName, setMidiName] = useState<string>('')
  const [midiSupported] = useState(isWebMidiSupported)
  const [midiBusy, setMidiBusy] = useState(false)
  const [pipSupported] = useState(isDocumentPipSupported)
  const [pipWindow, setPipWindow] = useState<Window | null>(null)

  useEffect(() => {
    const off = subscribeQualityMode((m) => setMode(m))
    return off
  }, [])

  // Online/offline tracking — surfaces a chip when the user is offline
  // (typically because they're on the train and the SW is serving the
  // app from cache). Reassures them that the page is intentionally
  // running offline, not broken.
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // SW update available — show a clickable "Update ready" chip
  useEffect(() => {
    const off = bus.on('custom:sw_update_available' as 'custom:sw_update_available', () => {
      setUpdateReady(true)
    })
    return off
  }, [])

  // Gamepad detection — surface a controller chip when one is plugged
  // in (or paired via Bluetooth). Recruiter sees the portfolio knows
  // about their controller.
  useEffect(() => {
    const off = bus.on('custom:gamepad' as 'custom:gamepad', (p) => {
      const payload = (p ?? {}) as { connected?: boolean; name?: string }
      setGamepadName(payload.connected ? (payload.name || 'Gamepad') : '')
    })
    // Initial check (in case it's already connected before mount)
    if (gamepadStateRef.connected) setGamepadName(gamepadStateRef.name)
    return off
  }, [])

  // MIDI detection — note that MIDI requires explicit user click
  // (permission prompt), so we only surface the device name AFTER
  // the user enables it via the chip.
  useEffect(() => {
    const off = bus.on('custom:midi' as 'custom:midi', (p) => {
      const payload = (p ?? {}) as { connected?: boolean; name?: string }
      setMidiName(payload.connected ? (payload.name || 'MIDI') : '')
    })
    if (midiStateRef.connected) setMidiName(midiStateRef.inputName)
    return off
  }, [])

  const onEnableMidi = async () => {
    if (midiBusy) return
    setMidiBusy(true)
    const ok = await startMidiInput()
    setMidiBusy(false)
    if (!ok) {
      setToast('midi unavailable')
      setToastKey((k) => k + 1)
      window.setTimeout(() => setToast(null), 1700)
    }
  }

  // PiP toggle — opens the floating window on first click, closes on
  // second click. Window-closed listener flips the toggle back if the
  // user closes via OS chrome instead.
  const onTogglePip = async () => {
    if (pipWindow) {
      closePipWindow()
      setPipWindow(null)
      return
    }
    const w = await openPipWindow({ width: 280, height: 180 })
    if (!w) {
      setToast('pip unavailable')
      setToastKey((k) => k + 1)
      window.setTimeout(() => setToast(null), 1700)
      return
    }
    setPipWindow(w)
  }

  // Listen for PiP window close so the toggle button reflects state
  useEffect(() => {
    const off = onPipWindowClosed(() => setPipWindow(null))
    return off
  }, [])

  if (!visible) return null

  const onShare = async () => {
    const ok = await sharePortfolio(SHARE_OPTS)
    if (ok) {
      const label = isWebShareSupported() ? 'shared' : 'link copied'
      setToast(label)
      setToastKey((k) => k + 1)
      window.setTimeout(() => setToast(null), 1700)
    }
  }

  return (
    <div className={styles.row} aria-live="polite">
      {!online && (
        <span className={styles.chipBadge} title="Offline — running from cache">
          <span className={styles.dot} />
          Offline ⚡
        </span>
      )}
      {gamepadName && (
        <span
          className={styles.chipBadge}
          title={`Controller connected: ${gamepadName}\nA = spin · B = mute · D-pad/RB-LB = nav · L-stick = parallax · Start = dev`}
        >
          <span className={styles.dot} />
          🎮 Gamepad
        </span>
      )}
      {midiName && (
        <span
          className={styles.chipBadge}
          title={`MIDI: ${midiName}\nC3=spin · D3=next · E3=back · F3/G3=item · A3=mute · B3=jackpot · C4↑ = playable\npitch wheel = parallax X · mod wheel = parallax Y · sustain = spin`}
        >
          <span className={styles.dot} />
          🎹 MIDI
        </span>
      )}
      {midiSupported && !midiName && (
        <button
          type="button"
          className={styles.chip}
          onClick={onEnableMidi}
          disabled={midiBusy}
          title="Enable MIDI input — plug a keyboard, then map keys to slot actions"
          aria-label="Enable MIDI input"
        >
          🎹 Enable MIDI
        </button>
      )}
      {pipSupported && (
        <button
          type="button"
          className={styles.chip}
          onClick={onTogglePip}
          aria-pressed={pipWindow !== null}
          title={pipWindow
            ? 'Close the Picture-in-Picture window'
            : 'Open a floating PiP window — current section + item stays on top of other apps'}
          aria-label={pipWindow ? 'Close Picture-in-Picture' : 'Open Picture-in-Picture'}
        >
          {pipWindow ? '✕ PiP' : '↗ PiP'}
        </button>
      )}
      {/* Render PiP card content into the floating window via portal.
          The window inherits parent styles in DocumentPiP so React's
          className-based styling works inside it. */}
      {pipWindow && createPortal(<PipCard />, pipWindow.document.body)}
      {mode === 'lite' && (
        <span
          className={styles.chipBadge}
          title="Adaptive quality: low battery / slow network — visuals auto-tuned down"
        >
          <span className={styles.dot} />
          Lite mode
        </span>
      )}
      {updateReady && (
        <button
          type="button"
          className={styles.chip}
          onClick={() => activatePendingUpdate()}
          title="A new version is ready — click to refresh"
          aria-label="Activate the pending update and refresh"
        >
          ⟳ Update ready
        </button>
      )}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className={styles.chip}
          onClick={onShare}
          aria-label="Share this portfolio"
          title="Share this portfolio"
        >
          ▸ Share
        </button>
        {toast && (
          <span key={toastKey} className={styles.toast}>{toast}</span>
        )}
      </div>
    </div>
  )
}

export default PlatformChips
