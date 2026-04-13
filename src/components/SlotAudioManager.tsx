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
import { playSynthById, setVolume, isAudioUnlocked, unlockAudioContext, bus } from '../engine'
import { isAudioBridgeConnected, getAssignedHooks } from '../engine/AudioBridge'
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

// ─── All hookable events — complete map for Audio Manager ───────────────────

interface HookDef {
  hookId: string
  event: string
  description: string
  category: 'boot' | 'splash' | 'transition' | 'slot' | 'audio' | 'system'
}

const ALL_HOOKS: HookDef[] = [
  // Boot
  { hookId: 'bootStart',       event: 'boot:start',           description: 'Boot sequence begins',         category: 'boot' },
  { hookId: 'bootProgress',    event: 'boot:progress',        description: 'Loading progress update',      category: 'boot' },
  { hookId: 'bootTap',         event: 'boot:tap',             description: 'User taps to begin',           category: 'boot' },
  { hookId: 'bootAudioUnlock', event: 'boot:audio_unlocked',  description: 'AudioContext unlocked',        category: 'boot' },
  { hookId: 'bootComplete',    event: 'boot:complete',        description: 'Boot finished, splash starts', category: 'boot' },
  { hookId: 'bootFadeOut',     event: 'boot:fade_out',        description: 'Boot screen fading out',       category: 'boot' },

  // Splash
  { hookId: 'splashStart',     event: 'splash:start',         description: 'Splash screen mounted',        category: 'splash' },
  { hookId: 'introWhoosh',     event: 'splash:title:corners', description: 'Corner brackets fade in',      category: 'splash' },
  { hookId: 'whoosh',          event: 'splash:title:label',   description: 'Label text slides in',         category: 'splash' },
  { hookId: 'reveal',          event: 'splash:title:name',    description: 'Name reveal animation',        category: 'splash' },
  { hookId: 'swoosh',          event: 'splash:title:line',    description: 'Decorative line draws',        category: 'splash' },
  { hookId: 'click',           event: 'splash:title:button',  description: 'CTA button appears',           category: 'splash' },
  { hookId: 'attractLoop',     event: 'splash:attract_loop',  description: 'Attract loop starts',          category: 'splash' },
  { hookId: 'splashEnter',     event: 'splash:enter',         description: 'User presses ENTER',           category: 'splash' },

  // Transition
  { hookId: 'transitionStart', event: 'transition:splash_to_slot', description: 'Splash→Slot transition begins', category: 'transition' },
  { hookId: 'transitionEnd',   event: 'transition:complete',       description: 'Transition complete, slot active', category: 'transition' },

  // Slot
  { hookId: 'reelSpin',        event: 'slot:spin:start',       description: 'Reels start spinning',           category: 'slot' },
  { hookId: 'leverRelease',    event: 'slot:spin:stop',        description: 'Spin stopping',                  category: 'slot' },
  { hookId: 'reelStop',        event: 'slot:reel:stop',        description: 'Individual reel stops',          category: 'slot' },
  { hookId: 'reelLand',        event: 'slot:reel:land',        description: 'Reel lands with bounce',         category: 'slot' },
  { hookId: 'sectionChange',   event: 'slot:section:change',   description: 'Portfolio section changes',      category: 'slot' },
  { hookId: 'win',             event: 'slot:win',              description: 'Win result (small/med/big/jp)',   category: 'slot' },
  { hookId: 'itemSelect',      event: 'slot:item:select',      description: 'Grid cell selected',             category: 'slot' },

  // Audio
  { hookId: 'ambientStart',    event: 'audio:ambient:start',   description: 'Ambient music begins',           category: 'audio' },
  { hookId: 'ambientStop',     event: 'audio:ambient:stop',    description: 'Ambient music stops',            category: 'audio' },
  { hookId: 'mute',            event: 'audio:mute',            description: 'All audio muted',                category: 'audio' },
  { hookId: 'unmute',          event: 'audio:unmute',          description: 'Audio unmuted',                  category: 'audio' },

  // System
  { hookId: 'debugToggle',     event: 'debug:toggle',          description: 'Debug panel toggled',            category: 'system' },
  { hookId: 'fpsDrop',         event: 'fps:drop',              description: 'FPS dropped below threshold',    category: 'system' },
  { hookId: 'fpsRecover',      event: 'fps:recover',           description: 'FPS recovered to normal',        category: 'system' },
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
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [assignedHooks, setAssignedHooks] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    const interval = window.setInterval(() => {
      setBridgeConnected(isAudioBridgeConnected())
      setAssignedHooks(getAssignedHooks())
    }, 1000)
    return () => clearInterval(interval)
  }, [open])

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

  const categories = [
    { key: 'splash', label: 'Splash SFX' },
    { key: 'boot', label: 'Boot SFX' },
    { key: 'slot', label: 'Slot SFX' },
    { key: 'ui', label: 'UI SFX' },
  ] as const

  const hookCategories = [
    { key: 'boot', label: 'Boot' },
    { key: 'splash', label: 'Splash' },
    { key: 'transition', label: 'Transition' },
    { key: 'slot', label: 'Slot' },
    { key: 'audio', label: 'Audio' },
    { key: 'system', label: 'System' },
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

        {/* Hook Map */}
        <div className={styles.soundList}>
          <div className={styles.sectionHeader}>
            Audio Hooks ({ALL_HOOKS.length}) — Bridge: {bridgeConnected ? '● Connected' : '○ Disconnected'}
          </div>
          {hookCategories.map(({ key, label }) => {
            const hooks = ALL_HOOKS.filter((h) => h.category === key)
            if (hooks.length === 0) return null
            return (
              <div key={key}>
                <div className={styles.sectionHeader}>{label}</div>
                {hooks.map((hook) => {
                  const assigned = assignedHooks.includes(hook.hookId)
                  return (
                    <div key={hook.hookId} className={styles.soundRow}>
                      <button
                        className={`${styles.playBtn} ${assigned ? styles.playing : ''}`}
                        onClick={() => bus.emit(hook.event as 'boot:start')}
                        type="button"
                        title={`Fire ${hook.event}`}
                      >
                        ⚡
                      </button>
                      <div className={styles.soundInfo}>
                        <div className={styles.soundName}>
                          {hook.hookId}
                          {assigned && <span className={styles.eventBadge}>assigned</span>}
                        </div>
                        <div className={styles.soundMeta}>
                          {hook.description} → <span className={styles.eventBadge}>{hook.event}</span>
                        </div>
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
