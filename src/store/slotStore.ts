/**
 * Slot Store — Zustand state for the slot machine
 */

import { create } from 'zustand'
import type { SpinPhase } from '../types'

/**
 * Coarse-grained ambient phase used by the global app shell / background
 * glow layers. Consumers (e.g. `<AppShellGlow>`) can subscribe just to
 * this slice and avoid re-rendering on every fine-grained `spinPhase`
 * transition.
 */
export type AmbientPhase = 'idle' | 'spinning' | 'landing' | 'winning'

interface SlotStore {
  currentSectionIdx: number   // 0-4
  currentItemIdx: number      // which project/skill/etc is in center
  isSpinning: boolean
  spinPhase: SpinPhase
  ambientPhase: AmbientPhase
  credits: number
  jackpot: number
  setSection: (idx: number) => void
  setItemIdx: (idx: number) => void
  setSpinning: (v: boolean) => void
  setSpinPhase: (p: SpinPhase) => void
  setAmbientPhase: (p: AmbientPhase) => void
  tickJackpot: () => void
}

export const useSlotStore = create<SlotStore>((set) => ({
  currentSectionIdx: 0,
  currentItemIdx: 0,
  isSpinning: false,
  spinPhase: 'idle',
  ambientPhase: 'idle',
  credits: 777,
  jackpot: 1337,

  setSection: (idx) => set({ currentSectionIdx: idx, currentItemIdx: 0 }),
  setItemIdx: (idx) => set({ currentItemIdx: idx }),
  setSpinning: (v) => set({ isSpinning: v }),
  setSpinPhase: (p) => set({ spinPhase: p }),
  setAmbientPhase: (p) => set({ ambientPhase: p }),
  tickJackpot: () =>
    set((s) => ({ jackpot: s.jackpot + Math.floor(Math.random() * 5) + 1 })),
}))

// ── Selectors ────────────────────────────────────────────────────────────────

/**
 * Maps the fine-grained `spinPhase` state machine to the coarse-grained
 * `ambientPhase` used for the global glow layer. This lives alongside
 * `ambientPhase` as a pure projection — components may choose either
 * surface depending on whether they want the raw state or the mapped one.
 *
 * NOTE: `setAmbientPhase` is the source of truth (driven by the system
 * subscriber in `useAmbientPhaseSync`). This selector exists for cases
 * where a component wants to derive it directly from `spinPhase` without
 * waiting for the delayed `landing → idle` transition.
 */
export function selectAmbientPhase(s: Pick<SlotStore, 'spinPhase'>): AmbientPhase {
  switch (s.spinPhase) {
    case 'windup':
    case 'spinning':
      return 'spinning'
    case 'landing':
    case 'snapping':
    case 'landed':
      return 'landing'
    case 'idle':
    default:
      return 'idle'
  }
}
