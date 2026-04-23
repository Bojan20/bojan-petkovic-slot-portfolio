/**
 * useChromaticShift — returns a CSS custom property payload for the
 * global hue-rotate / chromatic aberration overlay.
 *
 * Phase mapping (tuned for the futuristic cyberpunk palette):
 *   idle     →  0deg   (neutral, no shift)
 *   spinning →  18deg  (cyan drift — reads as motion)
 *   landing  → -12deg  (magenta counter-shift — reads as impact)
 *   winning  →  32deg  (saturated push — celebration)
 *
 * Returns both the raw numeric degree value and a ready-to-spread
 * React `style` object so callers can choose their integration level.
 *
 * @example
 *   const { style } = useChromaticShift(phase)
 *   <div className="app-shell" style={style}>…</div>
 *
 *   // or raw:
 *   const { deg } = useChromaticShift(phase)
 *   gsap.to(overlay, { '--chroma-shift': `${deg}deg` })
 */

import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { AmbientPhase } from '../store/slotStore'

export interface ChromaticShift {
  /** Raw hue-rotate value in degrees for the current phase. */
  deg: number
  /** CSS custom property string, e.g. `"18deg"`. */
  value: string
  /** Drop-in style object — sets `--chroma-shift`. */
  style: CSSProperties
}

const PHASE_DEG: Record<AmbientPhase, number> = {
  idle: 0,
  spinning: 18,
  landing: -12,
  winning: 32,
}

export function useChromaticShift(phase: AmbientPhase): ChromaticShift {
  return useMemo(() => {
    const deg = PHASE_DEG[phase] ?? 0
    const value = `${deg}deg`
    // CSSProperties doesn't know about custom props — cast via index access
    const style = { ['--chroma-shift' as string]: value } as CSSProperties
    return { deg, value, style }
  }, [phase])
}
