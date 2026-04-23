/**
 * Audio Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useAudioStore } from './audioStore'

describe('audioStore', () => {
  beforeEach(() => {
    useAudioStore.setState({
      masterVolume: 0.8,
      musicVolume: 0.7,
      sfxVolume: 0.6,
      isMuted: false,
      ambientPlaying: false,
      cinematicMode: true,
    })
  })

  it('starts with default volumes', () => {
    const state = useAudioStore.getState()
    expect(state.masterVolume).toBe(0.8)
    expect(state.musicVolume).toBe(0.7)
    expect(state.sfxVolume).toBe(0.6)
  })

  it('sets master volume clamped to 0-1', () => {
    useAudioStore.getState().setMasterVolume(1.5)
    expect(useAudioStore.getState().masterVolume).toBe(1)

    useAudioStore.getState().setMasterVolume(-0.5)
    expect(useAudioStore.getState().masterVolume).toBe(0)

    useAudioStore.getState().setMasterVolume(0.5)
    expect(useAudioStore.getState().masterVolume).toBe(0.5)
  })

  it('toggles mute', () => {
    expect(useAudioStore.getState().isMuted).toBe(false)
    useAudioStore.getState().toggleMute()
    expect(useAudioStore.getState().isMuted).toBe(true)
    useAudioStore.getState().toggleMute()
    expect(useAudioStore.getState().isMuted).toBe(false)
  })

  it('sets ambient playing', () => {
    useAudioStore.getState().setAmbientPlaying(true)
    expect(useAudioStore.getState().ambientPlaying).toBe(true)
  })

  it('defaults cinematicMode to true', () => {
    expect(useAudioStore.getState().cinematicMode).toBe(true)
  })

  it('toggles cinematicMode', () => {
    useAudioStore.getState().toggleCinematicMode()
    expect(useAudioStore.getState().cinematicMode).toBe(false)
    useAudioStore.getState().toggleCinematicMode()
    expect(useAudioStore.getState().cinematicMode).toBe(true)
  })

  it('sets cinematicMode directly', () => {
    useAudioStore.getState().setCinematicMode(false)
    expect(useAudioStore.getState().cinematicMode).toBe(false)
    useAudioStore.getState().setCinematicMode(true)
    expect(useAudioStore.getState().cinematicMode).toBe(true)
  })
})
