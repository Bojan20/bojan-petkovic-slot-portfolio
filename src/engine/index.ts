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

export {
  initAudioBridge,
  disposeAudioBridge,
  isAudioBridgeConnected,
  getAssignedHooks,
} from './AudioBridge'

export {
  attachAnalyser,
  disposeAnalyser,
  isAnalyserActive,
  levelsRef as audioLevelsRef,
} from './AudioReactive'
export type { AudioLevels } from './AudioReactive'

export {
  isVoiceSupported,
  isVoiceListening,
  startVoiceControl,
  stopVoiceControl,
  toggleVoiceControl,
  onVoiceStatus,
} from './VoiceControl'
export type { VoiceCommand, VoiceStatus } from './VoiceControl'

export {
  getReelPan,
  playReelAccent,
  playPaylineTravel,
  playJackpotBloom,
} from './SpatialAudio'

export { listenForKonami } from './KonamiCode'
export { startPerfMonitor, disposePerfMonitor, perfRef } from './PerfMonitor'
export type { PerfSnapshot } from './PerfMonitor'

export {
  startHapticOrchestra,
  disposeHapticOrchestra,
  isHapticEnabled,
  setHapticEnabled,
  vibrate,
  HAPTIC_PATTERNS,
} from './HapticOrchestra'
export type { HapticPattern } from './HapticOrchestra'

export {
  enableWakeLock,
  disableWakeLock,
  startPageVisibilityHandler,
  stopPageVisibilityHandler,
  registerAudioForVisibilityPause,
  isPageVisible,
  isWebShareSupported,
  sharePortfolio,
  startAdaptiveQuality,
  getQualityMode,
  subscribeQualityMode,
} from './PlatformPolish'
export type { ShareOptions, QualityMode } from './PlatformPolish'

export type {
  PortfolioConfig,
  SoundManagerConfig,
  SoundEventConfig,
  SequenceConfig,
  SequenceStep,
  BootConfig,
  AnimationPreset,
} from './config/configTypes'
