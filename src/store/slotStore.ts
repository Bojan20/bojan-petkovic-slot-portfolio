/**
 * Slot Store — Zustand state for the slot machine
 */

import { create } from 'zustand'
import type { SpinPhase } from '../types'

interface SlotStore {
  currentSectionIdx: number   // 0-4
  currentItemIdx: number      // which project/skill/etc is in center
  isSpinning: boolean
  spinPhase: SpinPhase
  credits: number
  jackpot: number
  setSection: (idx: number) => void
  setItemIdx: (idx: number) => void
  setSpinning: (v: boolean) => void
  setSpinPhase: (p: SpinPhase) => void
  tickJackpot: () => void
}

export const useSlotStore = create<SlotStore>((set) => ({
  currentSectionIdx: 0,
  currentItemIdx: 0,
  isSpinning: false,
  spinPhase: 'idle',
  credits: 777,
  jackpot: 1337,

  setSection: (idx) => set({ currentSectionIdx: idx, currentItemIdx: 0 }),
  setItemIdx: (idx) => set({ currentItemIdx: idx }),
  setSpinning: (v) => set({ isSpinning: v }),
  setSpinPhase: (p) => set({ spinPhase: p }),
  tickJackpot: () =>
    set((s) => ({ jackpot: s.jackpot + Math.floor(Math.random() * 5) + 1 })),
}))
