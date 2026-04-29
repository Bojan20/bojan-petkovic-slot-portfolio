/**
 * QuantumField — WebGPU 32k particle compute field over the nebula
 *
 * The "next layer up" from CyberNebula. Where the nebula paints
 * volumetric flow with a fragment shader, the QuantumField runs a
 * real GPGPU compute pass on 32 thousand particles every frame and
 * draws them as additive-blended billboards. Visually this reads as
 * a luminous dust cloud reacting to the music — the nebula provides
 * the body, the field provides the kinetic energy.
 *
 * Rendering layer order in BootScreen:
 *   z=0  CyberNebula           (volumetric WebGL background)
 *   z=1  QuantumField (this)   (additive WebGPU particle dust)
 *   z=3  CasinoField           (orbiting symbols, behind Lucky 7)
 *   z=4  sevenStage            (Lucky 7 hero)
 *   z=10 hud / continue / etc.
 *
 * Why a separate component instead of folding into CyberNebula:
 *   • Different rendering API (WebGPU vs WebGL1) — keeping them
 *     decoupled means the nebula keeps working on every browser
 *     while the quantum layer opportunistically activates on
 *     WebGPU-capable ones (Chromium 113+, Safari TP).
 *   • Different resource lifetimes — WebGPU device + storage
 *     buffers vs WebGL program + VBO.
 *   • Lets us route the particle layer through a different RAF
 *     budget if we ever need adaptive quality.
 *
 * Inputs (mirrors CyberNebula's interface):
 *   • parallaxRef — written by BootScreen RAF, read directly each
 *                   compute step as a force target
 *   • reducedMotion — pause RAF, render single frame, audio uniforms
 *                     forced to zero (consistent with nebula)
 *
 * Behavior on unsupported browsers:
 *   • If `navigator.gpu` is missing OR adapter request fails OR shader
 *     compile fails, the canvas stays empty (no errors thrown) — the
 *     nebula keeps carrying the scene and recruiters on Firefox/Safari
 *     never know there was a hidden upgrade path.
 */

import { useEffect, useRef } from 'react'
import styles from './QuantumField.module.css'
import type { ParallaxState } from './CasinoField'
import { createWebGPUField, isWebGPUSupported } from '../../engine/WebGPUCompute'
import { getQualityMode } from '../../engine'
import type { WebGPUFieldHandle } from '../../engine/WebGPUCompute'

interface QuantumFieldProps {
  /** Shared parallax state — same ref nebula + casino layers read */
  parallaxRef: React.RefObject<ParallaxState>
  /** Honor prefers-reduced-motion — freeze field, audio reactivity off */
  reducedMotion?: boolean
}

export function QuantumField({ parallaxRef, reducedMotion = false }: QuantumFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<WebGPUFieldHandle | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Quick capability gate — bail synchronously on browsers without WebGPU
    // so we don't even allocate the canvas backing store.
    if (!isWebGPUSupported()) {
      console.info('[QuantumField] WebGPU unavailable — particle layer disabled')
      return
    }

    // Adaptive quality — when the platform monitor flags 'lite' (low
    // battery / save-data / slow network), we still init but drop the
    // DPR cap further so the GPU job stays cheap. The compute step
    // itself is too cheap to cull (≤ 0.5ms on integrated GPUs); the
    // expensive part is fragment fill at native DPR.
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    const lite = getQualityMode() === 'lite'
    const dprCap = lite ? 0.5 : isCoarsePointer ? 0.75 : 1.5

    let cancelled = false

    // Async WebGPU init — adapter + device + pipelines all live in the
    // factory. We hold a ref to the handle so the cleanup function below
    // can dispose it even if the effect re-runs before init resolves.
    void (async () => {
      const handle = await createWebGPUField(
        canvas,
        // Cast — createWebGPUField's signature uses the {x, y} subset.
        parallaxRef as React.RefObject<{ x: number; y: number }>,
        { reducedMotion, dprCap },
      )
      if (cancelled) {
        handle?.dispose()
        return
      }
      if (!handle) {
        // Failed adapter / device request. Silent fall-through — the
        // canvas remains empty, the nebula carries the scene.
        return
      }
      handleRef.current = handle
      handle.start()
    })()

    const onResize = () => {
      handleRef.current?.resize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      handleRef.current?.dispose()
      handleRef.current = null
    }
  }, [parallaxRef, reducedMotion])

  return <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />
}

export default QuantumField
