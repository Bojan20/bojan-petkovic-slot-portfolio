/**
 * SlotAudioManager — Dev audio panel
 *
 * Basic playback UI for all CORTEX Engine sounds.
 * Toggle: Shift+A (dev mode only)
 *
 * Features:
 * - Play/stop all synth sounds
 * - Per-sound volume control
 * - Master/SFX/Music bus volumes
 * - Event → sound mapping view
 * - Keyboard shortcut hints
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { playSynthById, setVolume, isAudioUnlocked, unlockAudioContext } from '../engine'
import { portfolioConfig } from '../engine/config/portfolioConfig'
import styles from './SlotAudioManager.module.css'

// ─── Sound definitions with metadata ─────────────────────────────────────────

interface SoundDef {
  id: string
  name: string
  description: string
  category: 'splash' | 'boot' | 'slot' | 'ui'
}

const SOUNDS: SoundDef[] = [
  // Splash SFX
  { id: 'sfx_shimmer', name: 'Shimmer', description: 'Metallic chime — corners fade in', category: 'splash' },
  { id: 'sfx_whoosh', name: 'Whoosh', description: 'Filtered noise sweep — label slides in', category: 'splash' },
  { id: 'sfx_boom', name: 'Boom', description: 'Cinematic sub boom — name reveal', category: 'splash' },
  { id: 'sfx_sweep', name: 'Sweep', description: 'Resonant sawtooth — line draws', category: 'splash' },
  { id: 'sfx_ding', name: 'Ding', description: 'Bell tone C6+G6+C7 — button ready', category: 'splash' },

  // Boot SFX
  { id: 'sfx_boot_hum', name: 'Boot Hum', description: 'Low power-on hum + digital chirp', category: 'boot' },
  { id: 'sfx_boot_ready', name: 'Boot Ready', description: 'Ascending chime C5→E5→G5→C6', category: 'boot' },
]

// Build reverse mapping: sound ID → events that trigger it
function buildEventMap(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const [eventName, config] of Object.entries(portfolioConfig.audio.events)) {
    if (config.audio?.play) {
      const existing = map.get(config.audio.play) ?? []
      existing.push(eventName)
      map.set(config.audio.play, existing)
    }
  }
  return map
}

const EVENT_MAP = buildEventMap()

// ─── Component ───────────────────────────────────────────────────────────────

export function SlotAudioManager() {
  const [open, setOpen] = useState(false)
  const [volumes, setVolumes] = useState({ master: 0.8, sfx: 0.6, music: 0.7 })
  const [soundVolumes, setSoundVolumes] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {}
    for (const s of SOUNDS) v[s.id] = 1.0
    return v
  })
  const [playingId, setPlayingId] = useState<string | null>(null)
  const playTimeoutRef = useRef<number | null>(null)

  // Toggle with Shift+A
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.code === 'KeyA') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      // Escape to close
      if (e.code === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  // Play sound
  const handlePlay = useCallback(async (id: string) => {
    // Ensure audio is unlocked
    if (!isAudioUnlocked()) {
      await unlockAudioContext()
    }

    // Clear previous playing indicator
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current)

    setPlayingId(id)
    const vol = soundVolumes[id] ?? 1.0
    playSynthById(id, vol)

    // Auto-clear playing state after ~1.2s (most synths are under 1s)
    playTimeoutRef.current = window.setTimeout(() => setPlayingId(null), 1200)
  }, [soundVolumes])

  // Volume bus change
  const handleBusVolume = useCallback((bus_name: 'master' | 'sfx' | 'music', val: number) => {
    setVolumes((v) => ({ ...v, [bus_name]: val }))
    setVolume(bus_name, val)
  }, [])

  // Per-sound volume
  const handleSoundVolume = useCallback((id: string, val: number) => {
    setSoundVolumes((v) => ({ ...v, [id]: val }))
  }, [])

  // Close on overlay click
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setOpen(false)
  }, [])

  if (!open) return null

  // Group sounds by category
  const categories = [
    { key: 'splash', label: 'Splash SFX' },
    { key: 'boot', label: 'Boot SFX' },
    { key: 'slot', label: 'Slot SFX' },
    { key: 'ui', label: 'UI SFX' },
  ] as const

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.title}>Slot Audio Manager</div>
          <button className={styles.closeBtn} onClick={() => setOpen(false)} type="button">
            ✕
          </button>
        </div>

        {/* Volume buses */}
        <div className={styles.volumeSection}>
          {(['master', 'sfx', 'music'] as const).map((bus_name) => (
            <div key={bus_name} className={styles.volumeGroup}>
              <div className={styles.volumeLabel}>{bus_name}</div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volumes[bus_name]}
                onChange={(e) => handleBusVolume(bus_name, parseFloat(e.target.value))}
                className={styles.volumeSlider}
              />
              <div className={styles.volumeValue}>{Math.round(volumes[bus_name] * 100)}%</div>
            </div>
          ))}
        </div>

        {/* Sound list */}
        <div className={styles.soundList}>
          {categories.map(({ key, label }) => {
            const sounds = SOUNDS.filter((s) => s.category === key)
            if (sounds.length === 0) return null
            return (
              <div key={key}>
                <div className={styles.sectionHeader}>{label}</div>
                {sounds.map((sound) => {
                  const events = EVENT_MAP.get(sound.id) ?? []
                  return (
                    <div key={sound.id} className={styles.soundRow}>
                      <button
                        className={`${styles.playBtn} ${playingId === sound.id ? styles.playing : ''}`}
                        onClick={() => handlePlay(sound.id)}
                        type="button"
                        title={`Play ${sound.name}`}
                      >
                        {playingId === sound.id ? '■' : '▶'}
                      </button>

                      <div className={styles.soundInfo}>
                        <div className={styles.soundName}>{sound.name}</div>
                        <div className={styles.soundMeta}>
                          {sound.description}
                          {events.length > 0 && (
                            <>
                              {' '}
                              {events.map((ev) => (
                                <span key={ev} className={styles.eventBadge}>{ev}</span>
                              ))}
                            </>
                          )}
                        </div>
                      </div>

                      <div className={styles.soundVolume}>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={soundVolumes[sound.id] ?? 1}
                          onChange={(e) => handleSoundVolume(sound.id, parseFloat(e.target.value))}
                          className={styles.soundVolumeSlider}
                          title={`Volume: ${Math.round((soundVolumes[sound.id] ?? 1) * 100)}%`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          CORTEX Engine Audio Manager — <span className={styles.kbd}>Shift+A</span> toggle — <span className={styles.kbd}>Esc</span> close
        </div>
      </div>
    </div>
  )
}

export default SlotAudioManager
