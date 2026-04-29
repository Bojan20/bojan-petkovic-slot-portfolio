/**
 * Audio Store — Zustand state for audio playback
 *
 * Dual-layer architecture: Howler.js for playback, Tone.js for synth/DSP.
 * This store manages volumes, mute state, and active sound references.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AudioStore {
  // — State —
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  isMuted: boolean
  ambientPlaying: boolean
  /**
   * When `true` (default) procedural synths should render the futuristic
   * / cyberpunk palette. When `false`, classic casino palette is used.
   * SoundManager reads this flag — the store does not drive any synth
   * switching itself, it only persists the preference.
   */
  cinematicMode: boolean

  // — Actions —
  setMasterVolume: (vol: number) => void
  setMusicVolume: (vol: number) => void
  setSfxVolume: (vol: number) => void
  toggleMute: () => void
  /** Explicit mute setter (voice control "mute" / "unmute" commands). */
  setMuted: (muted: boolean) => void
  setAmbientPlaying: (playing: boolean) => void
  setCinematicMode: (on: boolean) => void
  toggleCinematicMode: () => void
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set) => ({
      masterVolume: 0.8,
      musicVolume: 0.7,
      sfxVolume: 0.6,
      isMuted: false,
      ambientPlaying: false,
      cinematicMode: true,

      setMasterVolume: (vol) => set({ masterVolume: clamp01(vol) }),
      setMusicVolume: (vol) => set({ musicVolume: clamp01(vol) }),
      setSfxVolume: (vol) => set({ sfxVolume: clamp01(vol) }),
      toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
      setMuted: (muted) => set({ isMuted: muted }),
      setAmbientPlaying: (playing) => set({ ambientPlaying: playing }),
      setCinematicMode: (on) => set({ cinematicMode: on }),
      toggleCinematicMode: () => set((s) => ({ cinematicMode: !s.cinematicMode })),
    }),
    {
      name: 'bp-slot-audio',
      partialize: (s) => ({
        masterVolume: s.masterVolume,
        musicVolume: s.musicVolume,
        sfxVolume: s.sfxVolume,
        isMuted: s.isMuted,
        cinematicMode: s.cinematicMode,
      }),
    }
  )
)

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
