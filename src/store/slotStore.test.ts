/**
 * Slot Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSlotStore, selectAmbientPhase } from './slotStore'

describe('slotStore', () => {
  beforeEach(() => {
    useSlotStore.setState({
      currentSectionIdx: 0,
      currentItemIdx: 0,
      isSpinning: false,
      spinPhase: 'idle',
      ambientPhase: 'idle',
      credits: 777,
      jackpot: 1337,
    })
  })

  it('starts with default values', () => {
    const state = useSlotStore.getState()
    expect(state.currentSectionIdx).toBe(0)
    expect(state.currentItemIdx).toBe(0)
    expect(state.isSpinning).toBe(false)
    expect(state.credits).toBe(777)
    expect(state.jackpot).toBe(1337)
  })

  it('sets section and resets item index', () => {
    useSlotStore.getState().setSection(2)
    const state = useSlotStore.getState()
    expect(state.currentSectionIdx).toBe(2)
    expect(state.currentItemIdx).toBe(0)
  })

  it('sets item index', () => {
    useSlotStore.getState().setItemIdx(3)
    expect(useSlotStore.getState().currentItemIdx).toBe(3)
  })

  it('toggles spinning', () => {
    useSlotStore.getState().setSpinning(true)
    expect(useSlotStore.getState().isSpinning).toBe(true)
    useSlotStore.getState().setSpinning(false)
    expect(useSlotStore.getState().isSpinning).toBe(false)
  })

  it('sets spin phase', () => {
    useSlotStore.getState().setSpinPhase('spinning')
    expect(useSlotStore.getState().spinPhase).toBe('spinning')
  })

  it('ticks jackpot by random amount', () => {
    const before = useSlotStore.getState().jackpot
    useSlotStore.getState().tickJackpot()
    const after = useSlotStore.getState().jackpot
    expect(after).toBeGreaterThan(before)
    expect(after - before).toBeLessThanOrEqual(5)
    expect(after - before).toBeGreaterThanOrEqual(1)
  })

  it('sets ambient phase', () => {
    useSlotStore.getState().setAmbientPhase('spinning')
    expect(useSlotStore.getState().ambientPhase).toBe('spinning')
    useSlotStore.getState().setAmbientPhase('winning')
    expect(useSlotStore.getState().ambientPhase).toBe('winning')
  })

  it('selectAmbientPhase maps spinPhase correctly', () => {
    expect(selectAmbientPhase({ spinPhase: 'idle' })).toBe('idle')
    expect(selectAmbientPhase({ spinPhase: 'windup' })).toBe('spinning')
    expect(selectAmbientPhase({ spinPhase: 'spinning' })).toBe('spinning')
    expect(selectAmbientPhase({ spinPhase: 'landing' })).toBe('landing')
    expect(selectAmbientPhase({ spinPhase: 'snapping' })).toBe('landing')
    expect(selectAmbientPhase({ spinPhase: 'landed' })).toBe('landing')
  })
})
