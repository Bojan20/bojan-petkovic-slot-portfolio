/**
 * Slot Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSlotStore } from './slotStore'

describe('slotStore', () => {
  beforeEach(() => {
    // Reset store
    useSlotStore.setState({
      activeTab: 'all',
      isSpinning: false,
      spinPhase: 'idle',
      credits: 1000,
      jackpot: 48750,
      centerRow: [],
    })
  })

  it('starts with default values', () => {
    const state = useSlotStore.getState()
    expect(state.activeTab).toBe('all')
    expect(state.isSpinning).toBe(false)
    expect(state.credits).toBe(1000)
  })

  it('sets active tab', () => {
    useSlotStore.getState().setActiveTab('games')
    expect(useSlotStore.getState().activeTab).toBe('games')
  })

  it('toggles spinning', () => {
    useSlotStore.getState().setSpinning(true)
    expect(useSlotStore.getState().isSpinning).toBe(true)
    useSlotStore.getState().setSpinning(false)
    expect(useSlotStore.getState().isSpinning).toBe(false)
  })

  it('increments credits', () => {
    useSlotStore.getState().incrementCredits(50)
    expect(useSlotStore.getState().credits).toBe(1050)
  })

  it('increments credits by 1 as default', () => {
    useSlotStore.getState().incrementCredits()
    expect(useSlotStore.getState().credits).toBe(1001)
  })

  it('ticks jackpot by random amount', () => {
    const before = useSlotStore.getState().jackpot
    useSlotStore.getState().tickJackpot()
    const after = useSlotStore.getState().jackpot
    expect(after).toBeGreaterThan(before)
    expect(after - before).toBeLessThanOrEqual(5)
    expect(after - before).toBeGreaterThanOrEqual(1)
  })
})
