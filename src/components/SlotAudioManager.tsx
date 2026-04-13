/**
 * SlotAudioManager — CORTEX Ultimate Audio Control Center
 *
 * Full-featured audio management panel with:
 * - Tab navigation (Sounds / Hooks / Sequences / Settings)
 * - Real-time waveform visualization (AnalyserNode)
 * - Sound sequence player with presets
 * - Per-category solo/mute
 * - Volume presets (Quiet/Normal/Loud/Cinema)
 * - Mini-mode floating indicator
 * - Keyboard: Shift+A toggle, Esc close
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playSynthById, setVolume, isAudioUnlocked, unlockAudioContext, bus, getSfxGain } from '../engine'
import { isAudioBridgeConnected, getAssignedHooks } from '../engine/AudioBridge'
import { portfolioConfig } from '../engine/config/portfolioConfig'
import styles from './SlotAudioManager.module.css'

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = 'sounds' | 'hooks' | 'sequences' | 'settings'
type Category = 'splash' | 'boot' | 'slot' | 'ui'
type HookCategory = 'boot' | 'splash' | 'transition' | 'slot' | 'audio' | 'system'

interface SoundDef {
  id: string
  name: string
  description: string
  category: Category
}

interface HookDef {
  hookId: string
  event: string
  description: string
  category: HookCategory
}

interface SequencePreset {
  id: string
  name: string
  description: string
  sounds: { id: string; delay: number }[]
}

interface VolumePreset {
  id: string
  name: string
  master: number
  sfx: number
  music: number
}

// ─── Data ───────────────────────────────────────────────────────────────────

const SOUNDS: SoundDef[] = [
  { id: 'sfx_shimmer', name: 'Shimmer', description: 'Metallic chime — corners fade in', category: 'splash' },
  { id: 'sfx_whoosh', name: 'Whoosh', description: 'Filtered noise sweep — label slides in', category: 'splash' },
  { id: 'sfx_boom', name: 'Boom', description: 'Cinematic sub boom — name reveal', category: 'splash' },
  { id: 'sfx_sweep', name: 'Sweep', description: 'Resonant sawtooth — line draws', category: 'splash' },
  { id: 'sfx_ding', name: 'Ding', description: 'Bell tone C6+G6+C7 — button ready', category: 'splash' },
  { id: 'sfx_boot_hum', name: 'Boot Hum', description: 'Low power-on hum + digital chirp', category: 'boot' },
  { id: 'sfx_boot_ready', name: 'Boot Ready', description: 'Ascending chime C5→E5→G5→C6', category: 'boot' },
]

const ALL_HOOKS: HookDef[] = [
  { hookId: 'bootStart',       event: 'boot:start',           description: 'Boot sequence begins',         category: 'boot' },
  { hookId: 'bootProgress',    event: 'boot:progress',        description: 'Loading progress update',      category: 'boot' },
  { hookId: 'bootTap',         event: 'boot:tap',             description: 'User taps to begin',           category: 'boot' },
  { hookId: 'bootAudioUnlock', event: 'boot:audio_unlocked',  description: 'AudioContext unlocked',        category: 'boot' },
  { hookId: 'bootComplete',    event: 'boot:complete',        description: 'Boot finished, splash starts', category: 'boot' },
  { hookId: 'bootFadeOut',     event: 'boot:fade_out',        description: 'Boot screen fading out',       category: 'boot' },
  { hookId: 'splashStart',     event: 'splash:start',         description: 'Splash screen mounted',        category: 'splash' },
  { hookId: 'introWhoosh',     event: 'splash:title:corners', description: 'Corner brackets fade in',      category: 'splash' },
  { hookId: 'whoosh',          event: 'splash:title:label',   description: 'Label text slides in',         category: 'splash' },
  { hookId: 'reveal',          event: 'splash:title:name',    description: 'Name reveal animation',        category: 'splash' },
  { hookId: 'swoosh',          event: 'splash:title:line',    description: 'Decorative line draws',        category: 'splash' },
  { hookId: 'click',           event: 'splash:title:button',  description: 'CTA button appears',           category: 'splash' },
  { hookId: 'attractLoop',     event: 'splash:attract_loop',  description: 'Attract loop starts',          category: 'splash' },
  { hookId: 'splashEnter',     event: 'splash:enter',         description: 'User presses ENTER',           category: 'splash' },
  { hookId: 'transitionStart', event: 'transition:splash_to_slot', description: 'Splash→Slot transition begins', category: 'transition' },
  { hookId: 'transitionEnd',   event: 'transition:complete',       description: 'Transition complete, slot active', category: 'transition' },
  { hookId: 'reelSpin',        event: 'slot:spin:start',       description: 'Reels start spinning',           category: 'slot' },
  { hookId: 'leverRelease',    event: 'slot:spin:stop',        description: 'Spin stopping',                  category: 'slot' },
  { hookId: 'reelStop',        event: 'slot:reel:stop',        description: 'Individual reel stops',          category: 'slot' },
  { hookId: 'reelLand',        event: 'slot:reel:land',        description: 'Reel lands with bounce',         category: 'slot' },
  { hookId: 'sectionChange',   event: 'slot:section:change',   description: 'Portfolio section changes',      category: 'slot' },
  { hookId: 'win',             event: 'slot:win',              description: 'Win result (small/med/big/jp)',   category: 'slot' },
  { hookId: 'itemSelect',      event: 'slot:item:select',      description: 'Grid cell selected',             category: 'slot' },
  { hookId: 'ambientStart',    event: 'audio:ambient:start',   description: 'Ambient music begins',           category: 'audio' },
  { hookId: 'ambientStop',     event: 'audio:ambient:stop',    description: 'Ambient music stops',            category: 'audio' },
  { hookId: 'mute',            event: 'audio:mute',            description: 'All audio muted',                category: 'audio' },
  { hookId: 'unmute',          event: 'audio:unmute',          description: 'Audio unmuted',                  category: 'audio' },
  { hookId: 'debugToggle',     event: 'debug:toggle',          description: 'Debug panel toggled',            category: 'system' },
  { hookId: 'fpsDrop',         event: 'fps:drop',              description: 'FPS dropped below threshold',    category: 'system' },
  { hookId: 'fpsRecover',      event: 'fps:recover',           description: 'FPS recovered to normal',        category: 'system' },
]

const SEQUENCE_PRESETS: SequencePreset[] = [
  {
    id: 'boot_full',
    name: 'Boot Sequence',
    description: 'Complete boot → ready flow',
    sounds: [
      { id: 'sfx_boot_hum', delay: 0 },
      { id: 'sfx_boot_ready', delay: 1200 },
    ],
  },
  {
    id: 'splash_full',
    name: 'Splash Sequence',
    description: 'Full splash title reveal',
    sounds: [
      { id: 'sfx_shimmer', delay: 0 },
      { id: 'sfx_whoosh', delay: 400 },
      { id: 'sfx_boom', delay: 800 },
      { id: 'sfx_sweep', delay: 1400 },
      { id: 'sfx_ding', delay: 2000 },
    ],
  },
  {
    id: 'full_flow',
    name: 'Full Flow',
    description: 'Boot → Splash → Ready (all sounds)',
    sounds: [
      { id: 'sfx_boot_hum', delay: 0 },
      { id: 'sfx_boot_ready', delay: 1200 },
      { id: 'sfx_shimmer', delay: 2400 },
      { id: 'sfx_whoosh', delay: 2800 },
      { id: 'sfx_boom', delay: 3200 },
      { id: 'sfx_sweep', delay: 3800 },
      { id: 'sfx_ding', delay: 4400 },
    ],
  },
  {
    id: 'stress_test',
    name: 'Stress Test',
    description: 'All sounds rapid-fire (overlap test)',
    sounds: [
      { id: 'sfx_boot_hum', delay: 0 },
      { id: 'sfx_shimmer', delay: 100 },
      { id: 'sfx_whoosh', delay: 200 },
      { id: 'sfx_boom', delay: 300 },
      { id: 'sfx_sweep', delay: 400 },
      { id: 'sfx_ding', delay: 500 },
      { id: 'sfx_boot_ready', delay: 600 },
    ],
  },
]

const VOLUME_PRESETS: VolumePreset[] = [
  { id: 'quiet', name: 'Quiet', master: 0.3, sfx: 0.4, music: 0.3 },
  { id: 'normal', name: 'Normal', master: 0.8, sfx: 0.6, music: 0.7 },
  { id: 'loud', name: 'Loud', master: 1.0, sfx: 0.85, music: 0.9 },
  { id: 'cinema', name: 'Cinema', master: 1.0, sfx: 1.0, music: 1.0 },
  { id: 'sfx_only', name: 'SFX Only', master: 0.8, sfx: 1.0, music: 0.0 },
  { id: 'music_only', name: 'Music Only', master: 0.8, sfx: 0.0, music: 1.0 },
]

const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  splash: { label: 'Splash', color: '#c9a227' },
  boot: { label: 'Boot', color: '#38bdf8' },
  slot: { label: 'Slot', color: '#a78bfa' },
  ui: { label: 'UI', color: '#34d399' },
}

const HOOK_CATEGORY_META: Record<HookCategory, { label: string; color: string }> = {
  boot: { label: 'Boot', color: '#38bdf8' },
  splash: { label: 'Splash', color: '#c9a227' },
  transition: { label: 'Transition', color: '#f472b6' },
  slot: { label: 'Slot', color: '#a78bfa' },
  audio: { label: 'Audio', color: '#34d399' },
  system: { label: 'System', color: '#fb923c' },
}

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

// ─── Waveform Visualizer ────────────────────────────────────────────────────

function WaveformCanvas({ analyserRef }: { analyserRef: React.RefObject<AnalyserNode | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      const analyser = analyserRef.current
      if (!analyser) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        drawIdleLine(ctx, canvas)
        return
      }

      const bufLen = analyser.frequencyBinCount
      const data = new Uint8Array(bufLen)
      analyser.getByteTimeDomainData(data)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Gradient stroke
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
      gradient.addColorStop(0, 'rgba(201, 162, 39, 0.6)')
      gradient.addColorStop(0.3, 'rgba(56, 189, 248, 0.8)')
      gradient.addColorStop(0.6, 'rgba(167, 139, 250, 0.8)')
      gradient.addColorStop(1, 'rgba(201, 162, 39, 0.6)')

      ctx.lineWidth = 2
      ctx.strokeStyle = gradient
      ctx.beginPath()

      const sliceWidth = canvas.width / bufLen
      let x = 0
      let hasSignal = false

      for (let i = 0; i < bufLen; i++) {
        const v = data[i]! / 128.0
        const y = (v * canvas.height) / 2
        if (Math.abs(v - 1.0) > 0.01) hasSignal = true
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }

      ctx.stroke()

      if (!hasSignal) {
        drawIdleLine(ctx, canvas)
      }

      // Glow effect
      ctx.shadowBlur = 8
      ctx.shadowColor = 'rgba(56, 189, 248, 0.3)'
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [analyserRef])

  return <canvas ref={canvasRef} className={styles.waveCanvas} width={580} height={48} />
}

function drawIdleLine(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const now = Date.now() / 1000
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.15)'
  ctx.lineWidth = 1
  for (let x = 0; x < canvas.width; x++) {
    const y = canvas.height / 2 + Math.sin(x * 0.02 + now * 2) * 3
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SlotAudioManager() {
  const [open, setOpen] = useState(false)
  const [miniMode, setMiniMode] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('sounds')
  const [volumes, setVolumes] = useState({ master: 0.8, sfx: 0.6, music: 0.7 })
  const [soundVolumes, setSoundVolumes] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {}
    for (const s of SOUNDS) v[s.id] = 1.0
    return v
  })
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [mutedCategories, setMutedCategories] = useState<Set<Category>>(new Set())
  const [soloCategory, setSoloCategory] = useState<Category | null>(null)
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [assignedHooks, setAssignedHooks] = useState<string[]>([])
  const [activePreset, setActivePreset] = useState<string>('normal')
  const [sequencePlaying, setSequencePlaying] = useState<string | null>(null)
  const [sequenceProgress, setSequenceProgress] = useState(0)
  const [lastPlayedSound, setLastPlayedSound] = useState<string | null>(null)

  const playTimeoutRef = useRef<number | null>(null)
  const sequenceTimersRef = useRef<number[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)

  // Setup AnalyserNode
  useEffect(() => {
    if (!open) return
    try {
      const sfxGain = getSfxGain()
      const ctx = sfxGain.context as AudioContext
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.85
      sfxGain.connect(analyser)
      analyserRef.current = analyser
      return () => {
        try { sfxGain.disconnect(analyser) } catch {}
        analyserRef.current = null
      }
    } catch {}
  }, [open])

  // Poll bridge status
  useEffect(() => {
    if (!open && !miniMode) return
    const interval = window.setInterval(() => {
      setBridgeConnected(isAudioBridgeConnected())
      setAssignedHooks(getAssignedHooks())
    }, 1000)
    return () => clearInterval(interval)
  }, [open, miniMode])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.code === 'KeyA') {
        e.preventDefault()
        if (open) {
          setOpen(false)
          setMiniMode(true)
        } else if (miniMode) {
          setMiniMode(false)
        } else {
          setOpen(true)
        }
      }
      if (e.code === 'Escape' && open) {
        setOpen(false)
        setMiniMode(true)
      }
      // Number keys 1-4 for tab switching when panel open
      if (open && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const tabs: Tab[] = ['sounds', 'hooks', 'sequences', 'settings']
        const idx = parseInt(e.key) - 1
        if (idx >= 0 && idx < tabs.length) {
          setActiveTab(tabs[idx]!)
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, miniMode])

  const handlePlay = useCallback(async (id: string) => {
    if (!isAudioUnlocked()) await unlockAudioContext()
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current)

    const cat = SOUNDS.find(s => s.id === id)?.category
    if (cat && mutedCategories.has(cat)) return
    if (soloCategory && cat !== soloCategory) return

    setPlayingId(id)
    setLastPlayedSound(id)
    const vol = soundVolumes[id] ?? 1.0
    playSynthById(id, vol)
    playTimeoutRef.current = window.setTimeout(() => setPlayingId(null), 1200)
  }, [soundVolumes, mutedCategories, soloCategory])

  const handleBusVolume = useCallback((busName: 'master' | 'sfx' | 'music', val: number) => {
    setVolumes(v => ({ ...v, [busName]: val }))
    setVolume(busName, val)
    setActivePreset('')
  }, [])

  const handleSoundVolume = useCallback((id: string, val: number) => {
    setSoundVolumes(v => ({ ...v, [id]: val }))
  }, [])

  const applyVolumePreset = useCallback((preset: VolumePreset) => {
    setVolumes({ master: preset.master, sfx: preset.sfx, music: preset.music })
    setVolume('master', preset.master)
    setVolume('sfx', preset.sfx)
    setVolume('music', preset.music)
    setActivePreset(preset.id)
  }, [])

  const toggleMuteCategory = useCallback((cat: Category) => {
    setMutedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const toggleSoloCategory = useCallback((cat: Category) => {
    setSoloCategory(prev => prev === cat ? null : cat)
  }, [])

  const playSequence = useCallback(async (preset: SequencePreset) => {
    if (!isAudioUnlocked()) await unlockAudioContext()
    stopSequence()
    setSequencePlaying(preset.id)
    setSequenceProgress(0)

    const totalDuration = Math.max(...preset.sounds.map(s => s.delay)) + 1500
    const startTime = Date.now()

    const progressInterval = window.setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / totalDuration, 1)
      setSequenceProgress(progress)
      if (progress >= 1) {
        clearInterval(progressInterval)
        setSequencePlaying(null)
        setSequenceProgress(0)
      }
    }, 50)
    sequenceTimersRef.current.push(progressInterval)

    for (const sound of preset.sounds) {
      const timer = window.setTimeout(() => {
        setPlayingId(sound.id)
        setLastPlayedSound(sound.id)
        playSynthById(sound.id, soundVolumes[sound.id] ?? 1.0)
        window.setTimeout(() => setPlayingId(null), 800)
      }, sound.delay)
      sequenceTimersRef.current.push(timer)
    }
  }, [soundVolumes])

  const stopSequence = useCallback(() => {
    sequenceTimersRef.current.forEach(t => clearTimeout(t))
    sequenceTimersRef.current = []
    setSequencePlaying(null)
    setSequenceProgress(0)
    setPlayingId(null)
  }, [])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false)
      setMiniMode(true)
    }
  }, [])

  const filteredSounds = useMemo(() => {
    return SOUNDS.filter(s => {
      if (soloCategory && s.category !== soloCategory) return false
      return true
    })
  }, [soloCategory])

  // ─── Mini Mode ──────────────────────────────────────────────────────────

  if (!open && miniMode) {
    return (
      <div
        className={`${styles.miniPill} ${lastPlayedSound ? styles.miniActive : ''}`}
        onClick={() => { setOpen(true); setMiniMode(false) }}
        title="Open Audio Manager (Shift+A)"
      >
        <div className={styles.miniIcon}>♪</div>
        {lastPlayedSound && (
          <div className={styles.miniLabel}>
            {SOUNDS.find(s => s.id === lastPlayedSound)?.name ?? lastPlayedSound}
          </div>
        )}
        <div className={`${styles.miniBridge} ${bridgeConnected ? styles.miniBridgeOn : ''}`} />
      </div>
    )
  }

  if (!open) return null

  // ─── Tab Content Renderers ──────────────────────────────────────────────

  const renderSoundsTab = () => {
    const categories: { key: Category; label: string }[] = [
      { key: 'splash', label: 'Splash SFX' },
      { key: 'boot', label: 'Boot SFX' },
      { key: 'slot', label: 'Slot SFX' },
      { key: 'ui', label: 'UI SFX' },
    ]

    return (
      <>
        {/* Category controls */}
        <div className={styles.categoryBar}>
          {categories.map(({ key, label }) => {
            const sounds = SOUNDS.filter(s => s.category === key)
            if (sounds.length === 0) return null
            const meta = CATEGORY_META[key]
            const isMuted = mutedCategories.has(key)
            const isSolo = soloCategory === key
            return (
              <div key={key} className={styles.categoryChip} style={{ '--cat-color': meta.color } as React.CSSProperties}>
                <span className={styles.categoryDot} />
                <span className={styles.categoryName}>{label}</span>
                <span className={styles.categoryCount}>{sounds.length}</span>
                <button
                  className={`${styles.catBtn} ${isMuted ? styles.catBtnActive : ''}`}
                  onClick={() => toggleMuteCategory(key)}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  type="button"
                >
                  M
                </button>
                <button
                  className={`${styles.catBtn} ${isSolo ? styles.catBtnActive : ''}`}
                  onClick={() => toggleSoloCategory(key)}
                  title={isSolo ? 'Unsolo' : 'Solo'}
                  type="button"
                >
                  S
                </button>
              </div>
            )
          })}
        </div>

        {/* Sound rows */}
        <div className={styles.scrollArea}>
          {categories.map(({ key, label }) => {
            const sounds = filteredSounds.filter(s => s.category === key)
            if (sounds.length === 0) return null
            const meta = CATEGORY_META[key]
            const isMuted = mutedCategories.has(key)
            return (
              <div key={key} className={isMuted ? styles.mutedSection : undefined}>
                <div className={styles.sectionHeader} style={{ '--cat-color': meta.color } as React.CSSProperties}>
                  <span className={styles.sectionDot} />
                  {label}
                </div>
                {sounds.map(sound => {
                  const events = EVENT_MAP.get(sound.id) ?? []
                  const isPlaying = playingId === sound.id
                  return (
                    <div key={sound.id} className={`${styles.soundRow} ${isPlaying ? styles.soundRowActive : ''}`}>
                      <button
                        className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
                        onClick={() => handlePlay(sound.id)}
                        type="button"
                        title={`Play ${sound.name}`}
                        style={{ '--cat-color': meta.color } as React.CSSProperties}
                      >
                        <span className={styles.playIcon}>{isPlaying ? '■' : '▶'}</span>
                        {isPlaying && <span className={styles.ripple} />}
                      </button>

                      <div className={styles.soundInfo}>
                        <div className={styles.soundName}>{sound.name}</div>
                        <div className={styles.soundMeta}>
                          {sound.description}
                          {events.length > 0 && (
                            <>
                              {' '}
                              {events.map(ev => (
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
                          onChange={e => handleSoundVolume(sound.id, parseFloat(e.target.value))}
                          className={styles.soundVolumeSlider}
                          title={`${Math.round((soundVolumes[sound.id] ?? 1) * 100)}%`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </>
    )
  }

  const renderHooksTab = () => {
    const hookCategories: { key: HookCategory; label: string }[] = [
      { key: 'boot', label: 'Boot' },
      { key: 'splash', label: 'Splash' },
      { key: 'transition', label: 'Transition' },
      { key: 'slot', label: 'Slot' },
      { key: 'audio', label: 'Audio' },
      { key: 'system', label: 'System' },
    ]

    return (
      <>
        <div className={styles.bridgeStatus}>
          <div className={`${styles.bridgeDot} ${bridgeConnected ? styles.bridgeOn : ''}`} />
          <span>Audio Bridge: {bridgeConnected ? 'Connected' : 'Disconnected'}</span>
          <span className={styles.hookCount}>{assignedHooks.length} assigned / {ALL_HOOKS.length} total</span>
        </div>
        <div className={styles.scrollArea}>
          {hookCategories.map(({ key, label }) => {
            const hooks = ALL_HOOKS.filter(h => h.category === key)
            if (hooks.length === 0) return null
            const meta = HOOK_CATEGORY_META[key]
            return (
              <div key={key}>
                <div className={styles.sectionHeader} style={{ '--cat-color': meta.color } as React.CSSProperties}>
                  <span className={styles.sectionDot} />
                  {label}
                  <span className={styles.sectionCount}>{hooks.length}</span>
                </div>
                {hooks.map(hook => {
                  const assigned = assignedHooks.includes(hook.hookId)
                  return (
                    <div key={hook.hookId} className={styles.soundRow}>
                      <button
                        className={`${styles.playBtn} ${assigned ? styles.assigned : ''}`}
                        onClick={() => bus.emit(hook.event as 'boot:start')}
                        type="button"
                        title={`Fire ${hook.event}`}
                        style={{ '--cat-color': meta.color } as React.CSSProperties}
                      >
                        <span className={styles.playIcon}>⚡</span>
                      </button>
                      <div className={styles.soundInfo}>
                        <div className={styles.soundName}>
                          {hook.hookId}
                          {assigned && <span className={styles.assignedBadge}>ASSIGNED</span>}
                        </div>
                        <div className={styles.soundMeta}>
                          {hook.description}
                          <span className={styles.eventBadge}>{hook.event}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </>
    )
  }

  const renderSequencesTab = () => (
    <div className={styles.scrollArea}>
      <div className={styles.sequenceGrid}>
        {SEQUENCE_PRESETS.map(preset => {
          const isActive = sequencePlaying === preset.id
          return (
            <div key={preset.id} className={`${styles.sequenceCard} ${isActive ? styles.sequenceActive : ''}`}>
              <div className={styles.sequenceHeader}>
                <div className={styles.sequenceName}>{preset.name}</div>
                <div className={styles.sequenceDesc}>{preset.description}</div>
              </div>
              <div className={styles.sequenceTimeline}>
                {preset.sounds.map((s, i) => {
                  const sound = SOUNDS.find(sd => sd.id === s.id)
                  const maxDelay = Math.max(...preset.sounds.map(x => x.delay))
                  const left = maxDelay > 0 ? (s.delay / maxDelay) * 100 : (i / preset.sounds.length) * 100
                  const meta = sound ? CATEGORY_META[sound.category] : null
                  return (
                    <div
                      key={`${s.id}-${i}`}
                      className={`${styles.timelineDot} ${playingId === s.id && isActive ? styles.timelineDotActive : ''}`}
                      style={{
                        left: `${left}%`,
                        '--dot-color': meta?.color ?? '#c9a227',
                      } as React.CSSProperties}
                      title={`${sound?.name ?? s.id} @ ${s.delay}ms`}
                    />
                  )
                })}
                {isActive && (
                  <div className={styles.timelineProgress} style={{ width: `${sequenceProgress * 100}%` }} />
                )}
              </div>
              <div className={styles.sequenceActions}>
                {isActive ? (
                  <button className={styles.seqStopBtn} onClick={stopSequence} type="button">
                    ■ Stop
                  </button>
                ) : (
                  <button
                    className={styles.seqPlayBtn}
                    onClick={() => playSequence(preset)}
                    type="button"
                    disabled={!!sequencePlaying}
                  >
                    ▶ Play
                  </button>
                )}
                <div className={styles.sequenceSounds}>
                  {preset.sounds.length} sounds · {Math.max(...preset.sounds.map(s => s.delay)) + 1200}ms
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Auto-test section */}
      <div className={styles.sectionHeader} style={{ '--cat-color': '#fb923c' } as React.CSSProperties}>
        <span className={styles.sectionDot} />
        Quick Actions
      </div>
      <div className={styles.quickActions}>
        <button
          className={styles.actionBtn}
          onClick={() => {
            const all: SequencePreset = {
              id: 'auto_all',
              name: 'All',
              description: '',
              sounds: SOUNDS.map((s, i) => ({ id: s.id, delay: i * 1500 })),
            }
            playSequence(all)
          }}
          type="button"
          disabled={!!sequencePlaying}
        >
          Auto-Test All Sounds
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => {
            ALL_HOOKS.forEach((hook, i) => {
              setTimeout(() => bus.emit(hook.event as 'boot:start'), i * 200)
            })
          }}
          type="button"
        >
          Fire All Events
        </button>
      </div>
    </div>
  )

  const renderSettingsTab = () => (
    <div className={styles.scrollArea}>
      {/* Volume Presets */}
      <div className={styles.sectionHeader} style={{ '--cat-color': '#c9a227' } as React.CSSProperties}>
        <span className={styles.sectionDot} />
        Volume Presets
      </div>
      <div className={styles.presetGrid}>
        {VOLUME_PRESETS.map(preset => (
          <button
            key={preset.id}
            className={`${styles.presetBtn} ${activePreset === preset.id ? styles.presetActive : ''}`}
            onClick={() => applyVolumePreset(preset)}
            type="button"
          >
            <div className={styles.presetName}>{preset.name}</div>
            <div className={styles.presetValues}>
              M:{Math.round(preset.master * 100)} S:{Math.round(preset.sfx * 100)} Mu:{Math.round(preset.music * 100)}
            </div>
          </button>
        ))}
      </div>

      {/* Volume Sliders */}
      <div className={styles.sectionHeader} style={{ '--cat-color': '#38bdf8' } as React.CSSProperties}>
        <span className={styles.sectionDot} />
        Bus Volumes
      </div>
      <div className={styles.volumeSection}>
        {(['master', 'sfx', 'music'] as const).map(busName => (
          <div key={busName} className={styles.volumeGroup}>
            <div className={styles.volumeHeader}>
              <div className={styles.volumeLabel}>{busName}</div>
              <div className={styles.volumeValue}>{Math.round(volumes[busName] * 100)}%</div>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volumes[busName]}
              onChange={e => handleBusVolume(busName, parseFloat(e.target.value))}
              className={styles.volumeSlider}
            />
          </div>
        ))}
      </div>

      {/* Info */}
      <div className={styles.sectionHeader} style={{ '--cat-color': '#34d399' } as React.CSSProperties}>
        <span className={styles.sectionDot} />
        System Info
      </div>
      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Sounds</span>
          <span className={styles.infoValue}>{SOUNDS.length}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Hooks</span>
          <span className={styles.infoValue}>{ALL_HOOKS.length}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Assigned</span>
          <span className={styles.infoValue}>{assignedHooks.length}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Bridge</span>
          <span className={`${styles.infoValue} ${bridgeConnected ? styles.infoGood : styles.infoBad}`}>
            {bridgeConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Audio</span>
          <span className={`${styles.infoValue} ${isAudioUnlocked() ? styles.infoGood : styles.infoBad}`}>
            {isAudioUnlocked() ? 'Unlocked' : 'Locked'}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Sequences</span>
          <span className={styles.infoValue}>{SEQUENCE_PRESETS.length}</span>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className={styles.sectionHeader} style={{ '--cat-color': '#a78bfa' } as React.CSSProperties}>
        <span className={styles.sectionDot} />
        Keyboard Shortcuts
      </div>
      <div className={styles.shortcutList}>
        <div className={styles.shortcutRow}>
          <span className={styles.kbd}>Shift+A</span>
          <span>Toggle panel / mini mode</span>
        </div>
        <div className={styles.shortcutRow}>
          <span className={styles.kbd}>Esc</span>
          <span>Close to mini mode</span>
        </div>
        <div className={styles.shortcutRow}>
          <span className={styles.kbd}>1-4</span>
          <span>Switch tabs</span>
        </div>
      </div>
    </div>
  )

  // ─── Main Render ────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'sounds', label: 'Sounds', icon: '♪' },
    { key: 'hooks', label: 'Hooks', icon: '⚡' },
    { key: 'sequences', label: 'Sequences', icon: '▶▶' },
    { key: 'settings', label: 'Settings', icon: '⚙' },
  ]

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.titleIcon}>◆</div>
            <div>
              <div className={styles.title}>CORTEX Audio</div>
              <div className={styles.subtitle}>Sound Control Center</div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.miniBtn}
              onClick={() => { setOpen(false); setMiniMode(true) }}
              type="button"
              title="Mini mode"
            >
              ─
            </button>
            <button className={styles.closeBtn} onClick={() => { setOpen(false); setMiniMode(false) }} type="button">
              ✕
            </button>
          </div>
        </div>

        {/* Waveform */}
        <div className={styles.waveSection}>
          <WaveformCanvas analyserRef={analyserRef} />
        </div>

        {/* Tabs */}
        <div className={styles.tabBar}>
          {TABS.map((tab, i) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabKey}>{i + 1}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === 'sounds' && renderSoundsTab()}
          {activeTab === 'hooks' && renderHooksTab()}
          {activeTab === 'sequences' && renderSequencesTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerBrand}>CORTEX Engine</span>
          <span className={styles.footerDivider}>·</span>
          <span>{SOUNDS.length} sounds</span>
          <span className={styles.footerDivider}>·</span>
          <span>{ALL_HOOKS.length} hooks</span>
          <span className={styles.footerDivider}>·</span>
          <span className={`${styles.footerBridge} ${bridgeConnected ? styles.footerBridgeOn : ''}`}>
            {bridgeConnected ? '● Bridge' : '○ Bridge'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default SlotAudioManager
