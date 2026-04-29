/**
 * VoiceIndicator — floating mic dot with click-to-toggle
 *
 * Bottom-left chip with a pulsing red dot when listening. Click to
 * toggle on/off. Last-command flash slides above the chip for ~1.6s
 * when a voice command fires.
 *
 * Hidden entirely if the browser doesn't support SpeechRecognition
 * (Firefox + a few embedded browsers). Otherwise renders in disabled
 * state until first click — we don't auto-start the recognizer because
 * it would prompt for mic permission unannounced (bad UX).
 *
 * Keyboard: V key also toggles (prevented when an input is focused).
 */

import { useEffect, useState } from 'react'
import styles from './VoiceIndicator.module.css'
import {
  isVoiceSupported,
  onVoiceStatus,
  toggleVoiceControl,
  type VoiceStatus,
} from '../engine/VoiceControl'

export function VoiceIndicator() {
  const [status, setStatus] = useState<VoiceStatus>(() => ({
    listening: false,
    supported: isVoiceSupported(),
    lastCommand: null,
    lastCommandAt: 0,
  }))
  // Re-key the flash element so the animation re-fires on each command
  // even if the same word is spoken twice in a row.
  const [flashKey, setFlashKey] = useState(0)

  useEffect(() => {
    let lastSeenAt = 0
    const off = onVoiceStatus((s) => {
      setStatus(s)
      // New command since last broadcast → re-trigger flash animation
      if (s.lastCommandAt > lastSeenAt) {
        lastSeenAt = s.lastCommandAt
        setFlashKey((k) => k + 1)
      }
    })
    return off
  }, [])

  // V key shortcut — same toggle as click. Skipped when typing in input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'v' && e.key !== 'V') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      toggleVoiceControl()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!status.supported) return null

  const label = status.listening ? 'Voice ON · say spin / next / mute' : 'Voice (V)'
  const recentCmd =
    status.lastCommand && performance.now() - status.lastCommandAt < 1700
      ? status.lastCommand
      : null

  return (
    <div className={styles.wrap} aria-live="polite">
      {recentCmd && (
        <span key={flashKey} className={styles.flash}>
          ▸ {recentCmd}
        </span>
      )}
      <button
        type="button"
        className={styles.btn}
        onClick={() => toggleVoiceControl()}
        aria-pressed={status.listening}
        aria-label={status.listening ? 'Disable voice control' : 'Enable voice control'}
        title={label}
      >
        <span className={`${styles.dot} ${status.listening ? styles.dotListening : ''}`} />
        {label}
      </button>
    </div>
  )
}

export default VoiceIndicator
