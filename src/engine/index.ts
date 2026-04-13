/**
 * CORTEX Engine — Public API
 *
 * Single import point for the entire engine.
 * Inspired by IGT Playa, built for the web.
 */

export { bus } from './EventBus'
export type { CortexEventMap } from './EventBus'

export { Sequencer, sequencer } from './Sequencer'

export {
  unlockAudioContext,
  isAudioUnlocked,
  initSoundManager,
  disposeSoundManager,
  playSynthById,
  setVolume,
  getSfxGain,
  getMusicGain,
  getMasterGain,
  getSoundConfig,
} from './SoundManager'

export { portfolioConfig } from './config/portfolioConfig'

export type {
  PortfolioConfig,
  SoundManagerConfig,
  SoundEventConfig,
  SequenceConfig,
  SequenceStep,
  BootConfig,
  AnimationPreset,
} from './config/configTypes'
