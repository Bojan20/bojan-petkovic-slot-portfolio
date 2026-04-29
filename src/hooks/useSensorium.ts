/**
 * useSensorium — environmental sensor + presence + XR probe lifecycle.
 *
 * Extracted from App.tsx as part of the P1.13 refactor. Owns the
 * Sensorium layer (Layer 6 in ARCHITECTURE.md) — every passive
 * "what's the environment doing" pipeline.
 *
 * Started: AmbientLightSensor, IdleDetector, Presence broadcast,
 * WebXR capability probe.
 *
 * The IdleDetector also wires "pause music when away, resume on
 * return" behavior — caller passes a ref to the audio element so
 * the hook can safely play/pause without owning the audio itself.
 */

import { useEffect } from 'react'
import {
  bus,
  startAmbientLightSensor, stopAmbientLightSensor,
  startIdleDetector, stopIdleDetector,
  startPresence, stopPresence,
  probeXrCapability,
  startComputePressure, stopComputePressure,
} from '../engine'

interface UseSensoriumOpts {
  /** Audio element to pause on user:idle / resume on user:active. */
  audioRef: React.RefObject<HTMLAudioElement | null>
  /** Called to ask "are we past the boot phase yet?" Used to gate
   *  audio resume — we never auto-play pre-tap (AudioContext rule). */
  shouldResumeAudio: () => boolean
  /** Idle threshold in ms. Defaults to 30s. */
  idleThresholdMs?: number
}

export function useSensorium({
  audioRef,
  shouldResumeAudio,
  idleThresholdMs = 30_000,
}: UseSensoriumOpts): void {
  // Ambient light + Idle detector — the IdleDetector also drives
  // ambient-music pause/resume so we colocate them.
  useEffect(() => {
    void startAmbientLightSensor()
    startIdleDetector(idleThresholdMs)

    const offIdle = bus.on('user:idle', () => {
      const a = audioRef.current
      if (a && !a.paused) a.pause()
    })
    const offActive = bus.on('user:active', () => {
      const a = audioRef.current
      if (a && a.paused && shouldResumeAudio()) {
        a.play().catch(() => {})
      }
    })

    return () => {
      stopAmbientLightSensor()
      stopIdleDetector()
      offIdle()
      offActive()
    }
  }, [audioRef, shouldResumeAudio, idleThresholdMs])

  // Presence — BroadcastChannel between tabs (+ optional WebTransport)
  useEffect(() => {
    void startPresence(undefined)
    return () => { void stopPresence() }
  }, [])

  // WebXR capability probe — non-blocking, one-shot
  useEffect(() => {
    void probeXrCapability()
  }, [])

  // Compute Pressure observer (P2) — fires only when CPU pressure
  // changes bucket. Surfaces level via --perf-pressure CSS var +
  // custom:perf:pressure event so motion-heavy layers can degrade
  // before the user sees jank.
  useEffect(() => {
    void startComputePressure(1000)
    return () => { stopComputePressure() }
  }, [])
}
