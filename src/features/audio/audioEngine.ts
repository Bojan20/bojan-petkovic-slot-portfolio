/**
 * Audio Engine — Dual-Layer Architecture
 *
 * Layer 1: Howler.js — file-based playback (music, SFX, ambience)
 * Layer 2: Tone.js — procedural synth (UI sounds, win celebrations)
 *
 * Both routed through a shared Web Audio context for consistent volume control.
 */

import { Howl, Howler } from 'howler'
import * as Tone from 'tone'

// ============================================================
// WEB AUDIO CONTEXT SETUP
// ============================================================

let _audioUnlocked = false

/**
 * Unlock audio context on first user gesture.
 * Must be called from a click/touch handler.
 */
export async function unlockAudio(): Promise<void> {
  if (_audioUnlocked) return

  // Unlock Howler
  Howler.ctx?.resume()

  // Unlock Tone.js
  await Tone.start()

  _audioUnlocked = true
  console.log('[AudioEngine] Audio context unlocked')
}

export function isAudioUnlocked(): boolean {
  return _audioUnlocked
}

// ============================================================
// HOWLER LAYER — File Playback
// ============================================================

const _howlCache = new Map<string, Howl>()

interface PlayOptions {
  volume?: number
  loop?: boolean
  rate?: number
  fade?: { from: number; to: number; duration: number }
  onEnd?: () => void
}

/**
 * Play an audio file via Howler.js.
 * Caches Howl instances for reuse.
 */
export function playSound(
  src: string | string[],
  opts: PlayOptions = {}
): Howl {
  const key = Array.isArray(src) ? src.join('|') : src
  let howl = _howlCache.get(key)

  if (!howl) {
    howl = new Howl({
      src: Array.isArray(src) ? src : [src],
      volume: opts.volume ?? 1,
      loop: opts.loop ?? false,
      rate: opts.rate ?? 1,
      preload: true,
      html5: false, // Web Audio for low latency
      onend: opts.onEnd,
    })
    _howlCache.set(key, howl)
  } else {
    howl.volume(opts.volume ?? 1)
    howl.loop(opts.loop ?? false)
    howl.rate(opts.rate ?? 1)
  }

  const id = howl.play()

  if (opts.fade) {
    howl.fade(opts.fade.from, opts.fade.to, opts.fade.duration, id)
  }

  return howl
}

/**
 * Stop and unload a cached sound.
 */
export function stopSound(src: string): void {
  const howl = _howlCache.get(src)
  if (howl) {
    howl.stop()
    howl.unload()
    _howlCache.delete(src)
  }
}

/**
 * Set global Howler volume (0–1).
 */
export function setMasterVolume(vol: number): void {
  Howler.volume(Math.max(0, Math.min(1, vol)))
}

/**
 * Stop all Howler sounds.
 */
export function stopAll(): void {
  Howler.stop()
  _howlCache.forEach((h) => h.unload())
  _howlCache.clear()
}

// ============================================================
// TONE.JS LAYER — Procedural Synth
// ============================================================

let _synth: Tone.PolySynth | null = null
let _metalSynth: Tone.MetalSynth | null = null

function getSynth(): Tone.PolySynth {
  if (!_synth) {
    _synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.3 },
    }).toDestination()
    _synth.volume.value = -12
  }
  return _synth
}

function getMetalSynth(): Tone.MetalSynth {
  if (!_metalSynth) {
    _metalSynth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).toDestination()
    _metalSynth.volume.value = -20
  }
  return _metalSynth
}

/**
 * Play a UI click/hover synth sound.
 */
export function playUIClick(): void {
  if (!_audioUnlocked) return
  const synth = getSynth()
  synth.triggerAttackRelease('C6', '32n', undefined, 0.3)
}

/**
 * Play a reel tick sound (metallic click).
 */
export function playReelTick(): void {
  if (!_audioUnlocked) return
  const metal = getMetalSynth()
  metal.triggerAttackRelease(200, '16n')
}

/**
 * Play a spin start sound (ascending).
 */
export function playSpinStart(): void {
  if (!_audioUnlocked) return
  const synth = getSynth()
  const now = Tone.now()
  synth.triggerAttackRelease('E4', '16n', now, 0.4)
  synth.triggerAttackRelease('A4', '16n', now + 0.05, 0.4)
  synth.triggerAttackRelease('C#5', '16n', now + 0.1, 0.4)
}

/**
 * Play a reel land sound (descending thud).
 */
export function playReelLand(columnIndex: number): void {
  if (!_audioUnlocked) return
  const synth = getSynth()
  const notes = ['G3', 'A3', 'B3', 'C4', 'D4']
  const note = notes[columnIndex % notes.length]
  if (note) {
    synth.triggerAttackRelease(note, '8n', undefined, 0.5)
  }
}

/**
 * Play win celebration sequence.
 */
export function playWinFanfare(): void {
  if (!_audioUnlocked) return
  const synth = getSynth()
  const now = Tone.now()
  const notes = ['C5', 'E5', 'G5', 'C6']
  notes.forEach((note, i) => {
    synth.triggerAttackRelease(note, '8n', now + i * 0.12, 0.6)
  })
}

// ============================================================
// CLEANUP
// ============================================================

export function disposeAudio(): void {
  stopAll()
  _synth?.dispose()
  _metalSynth?.dispose()
  _synth = null
  _metalSynth = null
}
