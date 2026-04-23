/**
 * useAmbientPhase — subscribe to the coarse-grained global ambient
 * glow phase driven by the slot machine state.
 *
 * Uses Zustand's selector pattern so consumers only re-render when
 * the `ambientPhase` slice actually changes — `spinPhase` churn
 * (e.g. `windup → spinning`) is collapsed into a single `spinning`
 * ambient state.
 *
 * @example
 *   const phase = useAmbientPhase()
 *   <div className={`glow glow--${phase}`} />
 */

import { useSlotStore } from '../store/slotStore'
import type { AmbientPhase } from '../store/slotStore'

export function useAmbientPhase(): AmbientPhase {
  return useSlotStore((s) => s.ambientPhase)
}
