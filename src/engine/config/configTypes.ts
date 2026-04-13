/**
 * CORTEX Engine — Config Type Definitions
 *
 * TypeScript types for portfolio-config.json.
 * Every field is typed — zero any, zero unknown.
 */

// ─── Sound Event Config ──────────────────────────────────────────────────────

export interface SoundEventAudio {
  /** Sound ID from synth library or audio sprite */
  play: string
  /** Volume 0.0 – 1.0 (default 1.0) */
  volume?: number
  /** Stereo pan -1.0 (left) to 1.0 (right) */
  pan?: number
  /** Fade in duration in ms */
  fadeIn?: number
}

export interface SoundEventConfig {
  audio?: SoundEventAudio
  /** Haptic pattern name or raw vibration array */
  haptic?: string | number[]
}

// ─── Sound Manager Config ────────────────────────────────────────────────────

export interface SoundManagerConfig {
  volumes: {
    master: number
    music: number
    sfx: number
  }
  events: Record<string, SoundEventConfig>
}

// ─── Sequence Config ─────────────────────────────────────────────────────────

export interface SequenceStep {
  /** Event to emit when this step starts */
  event: string
  /** Delay in ms before this step (relative to sequence start or previous step) */
  delay?: number
  /** Duration in ms this step takes (Sequencer waits this before next step) */
  duration?: number
}

export interface SequenceConfig {
  /** Unique sequence name */
  name: string
  /** Steps to execute in order */
  steps: SequenceStep[]
}

// ─── Animation Preset Config ─────────────────────────────────────────────────

export interface AnimationPreset {
  preset: string
  duration?: number
  ease?: string
  delay?: number
}

// ─── Boot Config ─────────────────────────────────────────────────────────────

export interface BootConfig {
  /** Duration of simulated loading in ms */
  progressDuration: number
  /** Steps shown during loading */
  loadingSteps: string[]
  /** Minimum time boot screen is visible (ms) */
  minDisplayTime: number
}

// ─── Master Portfolio Config ─────────────────────────────────────────────────

export interface PortfolioConfig {
  version: string

  boot: BootConfig

  audio: SoundManagerConfig

  sequences: Record<string, SequenceConfig>

  animations: Record<string, AnimationPreset>

  timing: {
    splashStageDelays: number[]
    reelLandDelays: number[]
    bootProgressDuration: number
  }
}
