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
  /**
   * When `true` (default) the SpeechAnnouncer narrates boot complete,
   * section changes, project selection, and wins. Persisted so a user
   * who silenced the voice once stays silent across visits — the master
   * mute already gates the voice but this is a separate toggle so users
   * can keep music + sfx and silence just the narration.
   */
  announcerEnabled: boolean
  /**
   * P0.4 — Near-miss engine toggle. When `true` (default), the slot
   * machine occasionally lands a jackpot-eligible row one cell off-
   * jackpot. This is the standard slot-machine engagement multiplier,
   * disclosed in the dev overlay. Set to `false` to disable bias —
   * slot then always lands on whatever row the user spun to.
   * Probability is fixed at 0.25 (25%) when enabled.
   */
  nearMissEnabled: boolean

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
  setAnnouncerEnabled: (on: boolean) => void
  toggleAnnouncer: () => void
  setNearMissEnabled: (on: boolean) => void
  toggleNearMiss: () => void
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
      announcerEnabled: true,
      nearMissEnabled: true,

      setMasterVolume: (vol) => set({ masterVolume: clamp01(vol) }),
      setMusicVolume: (vol) => set({ musicVolume: clamp01(vol) }),
      setSfxVolume: (vol) => set({ sfxVolume: clamp01(vol) }),
      toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
      setMuted: (muted) => set({ isMuted: muted }),
      setAmbientPlaying: (playing) => set({ ambientPlaying: playing }),
      setCinematicMode: (on) => set({ cinematicMode: on }),
      toggleCinematicMode: () => set((s) => ({ cinematicMode: !s.cinematicMode })),
      setAnnouncerEnabled: (on) => set({ announcerEnabled: on }),
      toggleAnnouncer: () => set((s) => ({ announcerEnabled: !s.announcerEnabled })),
      setNearMissEnabled: (on) => set({ nearMissEnabled: on }),
      toggleNearMiss: () => set((s) => ({ nearMissEnabled: !s.nearMissEnabled })),
    }),
    {
      name: 'bp-slot-audio',
      partialize: (s) => ({
        masterVolume: s.masterVolume,
        musicVolume: s.musicVolume,
        sfxVolume: s.sfxVolume,
        isMuted: s.isMuted,
        cinematicMode: s.cinematicMode,
        announcerEnabled: s.announcerEnabled,
        nearMissEnabled: s.nearMissEnabled,
      }),
    }
  )
)

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
