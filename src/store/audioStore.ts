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

  // — Actions —
  setMasterVolume: (vol: number) => void
  setMusicVolume: (vol: number) => void
  setSfxVolume: (vol: number) => void
  toggleMute: () => void
  setAmbientPlaying: (playing: boolean) => void
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set) => ({
      masterVolume: 0.8,
      musicVolume: 0.7,
      sfxVolume: 0.6,
      isMuted: false,
      ambientPlaying: false,

      setMasterVolume: (vol) => set({ masterVolume: clamp01(vol) }),
      setMusicVolume: (vol) => set({ musicVolume: clamp01(vol) }),
      setSfxVolume: (vol) => set({ sfxVolume: clamp01(vol) }),
      toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
      setAmbientPlaying: (playing) => set({ ambientPlaying: playing }),
    }),
    {
      name: 'bp-slot-audio',
      partialize: (s) => ({
        masterVolume: s.masterVolume,
        musicVolume: s.musicVolume,
        sfxVolume: s.sfxVolume,
        isMuted: s.isMuted,
      }),
    }
  )
)

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
