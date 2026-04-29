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

export {
  attachMediaSession,
  disposeMediaSession,
  isMediaSessionSupported,
} from './MediaSession'
export type { MediaTrackInfo } from './MediaSession'

export {
  startGamepadInput,
  stopGamepadInput,
  setStickCursorWriter,
  gamepadStateRef,
} from './GamepadInput'

export {
  startMidiInput,
  stopMidiInput,
  setMidiCursorWriter,
  isWebMidiSupported,
  midiStateRef,
} from './MidiInput'

export {
  isDocumentPipSupported,
  isPipWindowOpen,
  openPipWindow,
  closePipWindow,
  getPipWindow,
  onPipWindowClosed,
} from './DocumentPiP'

export {
  registerPaintWorklets,
  isHoudiniPaintSupported,
} from './HoudiniPaint'

export {
  isWebGPUSupported,
  createWebGPUField,
} from './WebGPUCompute'
export type { WebGPUFieldHandle, WebGPUFieldOptions } from './WebGPUCompute'

export {
  isSpeechSynthSupported,
  initSpeechAnnouncer,
  disposeSpeechAnnouncer,
  isAnnouncerActive,
  announce,
} from './SpeechAnnouncer'

export {
  isAmbientLightSupported,
  startAmbientLightSensor,
  stopAmbientLightSensor,
  getCurrentLux,
  getCurrentLuxNorm,
  startIdleDetector,
  stopIdleDetector,
  isUserIdle,
} from './EnvironmentSensors'

export {
  isCompressionStreamSupported,
  isFileSystemAccessSupported,
  captureSnapshot,
  exportSnapshot,
  importSnapshot,
  applySnapshot,
} from './SnapshotExport'
export type { PortfolioSnapshotV1 } from './SnapshotExport'

export {
  snapshotToSvg,
  exportSnapshotSvg,
  downloadSnapshotSvg,
} from './SnapshotArt'

export {
  isReelCaptureSupported,
  isReelCapturing,
  startReelCapture,
  stopReelCapture,
  getReelDurationMs,
} from './PortfolioReel'

export {
  isWebHidSupported,
  connectHidDevice,
  disconnectHidDevice,
  startHidAutoBind,
  stopHidAutoBind,
  isHidConnected,
  getActiveHidName,
} from './HidInput'

export {
  isOpfsSupported,
  opfsWrite,
  opfsRead,
  opfsReadBuffer,
  opfsDelete,
  opfsExists,
  opfsList,
  opfsUsageBytes,
  opfsFetchOrCache,
} from './OpfsCache'

export {
  isImageDecoderSupported,
  isMimeDecodable,
  loadAnimatedImage,
} from './AnimatedImage'
export type { AnimatedImageHandle } from './AnimatedImage'

export {
  isWebSerialSupported,
  connectSerialDevice,
  disconnectSerialDevice,
  startSerialAutoBind,
  stopSerialAutoBind,
  isSerialConnected,
} from './SerialInput'

export {
  isHeartRateSupported,
  connectHeartRateMonitor,
  disconnectHeartRateMonitor,
  isHeartRateConnected,
  getCurrentBpm,
  getCurrentBpmNorm,
} from './HeartRate'

export {
  isWebTransportSupported,
  isBroadcastChannelSupported,
  startPresence,
  stopPresence,
  getPresenceCount,
  getPresenceTier,
  getSelfId,
} from './Presence'

export {
  isWebXrSupported,
  probeXrCapability,
  getXrCapability,
  enterImmersive,
  exitImmersive,
  isImmersiveActive,
} from './WebXrMode'
export type { XrCapability } from './WebXrMode'

export {
  cellKey,
  loadCellMemory,
  recordVisit,
  recordExpand,
  isCellVisited,
  getCellMemory,
  getVisitedKeys,
  getTotalDwellMs,
  clearCellMemory,
} from './CellMemory'
export type { CellMemoryEntry } from './CellMemory'

export {
  scheduleKeyDetection,
  detectKeyNow,
  isKeyDetected,
  resetKeyDetector,
} from './TonalAnalyzer'

export {
  startPersonaInference,
  stopPersonaInference,
  getCurrentPersona,
  getCurrentFeatures,
  forceReclassify,
} from './PersonaInference'
export type { Persona } from './PersonaInference'

export {
  transition as spinPhaseTransition,
  isSpinLocked,
  isLanded,
} from './SpinPhaseMachine'
export type { SpinEvent } from './SpinPhaseMachine'

export {
  isComputePressureSupported,
  startComputePressure,
  stopComputePressure,
  getCurrentPressure,
  getCurrentPressureLoad,
} from './ComputePressure'
export type { PressureLevel } from './ComputePressure'

export {
  initTransitionDirector,
  getTransitionDirector,
  disposeTransitionDirector,
} from './TransitionDirector'
export type { AppPhase, TransitionLabel, DirectorOpts } from './TransitionDirector'

export {
  onAudioCue,
  startAudioBus,
  stopAudioBus,
  isAudioBusStarted,
} from './AudioBus'

export type {
  PortfolioConfig,
  SoundManagerConfig,
  SoundEventConfig,
  SequenceConfig,
  SequenceStep,
  BootConfig,
  AnimationPreset,
} from './config/configTypes'
