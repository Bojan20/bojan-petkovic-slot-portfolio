/**
 * Slot Store — Zustand state for the slot machine
 *
 * Manages reel columns, spin state, active tab, credits/jackpot display.
 */

import { create } from 'zustand'
import type { PortfolioCategory, ReelCell, SpinPhase } from '../types'

interface SlotStore {
  // — State —
  activeTab: PortfolioCategory
  isSpinning: boolean
  spinPhase: SpinPhase
  credits: number
  jackpot: number
  centerRow: ReelCell[]

  // — Actions —
  setActiveTab: (tab: PortfolioCategory) => void
  setSpinning: (spinning: boolean) => void
  setSpinPhase: (phase: SpinPhase) => void
  setCenterRow: (cells: ReelCell[]) => void
  incrementCredits: (amount?: number) => void
  tickJackpot: () => void
}

export const useSlotStore = create<SlotStore>((set) => ({
  activeTab: 'all',
  isSpinning: false,
  spinPhase: 'idle',
  credits: 1000,
  jackpot: 48750,
  centerRow: [],

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSpinning: (spinning) => set({ isSpinning: spinning }),
  setSpinPhase: (phase) => set({ spinPhase: phase }),
  setCenterRow: (cells) => set({ centerRow: cells }),
  incrementCredits: (amount = 1) =>
    set((s) => ({ credits: s.credits + amount })),
  tickJackpot: () =>
    set((s) => ({ jackpot: s.jackpot + Math.floor(Math.random() * 5) + 1 })),
}))
