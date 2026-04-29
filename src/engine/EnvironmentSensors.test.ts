/**
 * Unit tests for normalizeLux — the log curve mapping ambient lux to
 * a 0..1 perceptual exertion value used to drive --ambient-lux.
 */

import { describe, it, expect } from 'vitest'
import { normalizeLux } from './EnvironmentSensors'

describe('normalizeLux', () => {
  it('maps 0 lux to 0', () => {
    expect(normalizeLux(0)).toBe(0)
  })

  it('maps negative lux to 0 (defensive)', () => {
    expect(normalizeLux(-50)).toBe(0)
  })

  it('maps tiny dim-room values to a low fraction', () => {
    // ~10 lux is the dimmest a phone screen reads as "indoor"
    const v = normalizeLux(10)
    expect(v).toBeGreaterThan(0.15)
    expect(v).toBeLessThan(0.35)
  })

  it('maps office-typical lux (~200) into the 0.5..0.65 band', () => {
    const v = normalizeLux(200)
    expect(v).toBeGreaterThan(0.5)
    expect(v).toBeLessThan(0.65)
  })

  it('maps bright office (~1000) above 0.7', () => {
    expect(normalizeLux(1000)).toBeGreaterThan(0.7)
  })

  it('clamps direct sunlight (10000+) at 1', () => {
    expect(normalizeLux(10000)).toBeCloseTo(1, 2)
    expect(normalizeLux(50000)).toBe(1)
  })

  it('is monotonically non-decreasing', () => {
    let prev = -1
    for (const lux of [0, 1, 10, 50, 200, 500, 1000, 5000, 50000]) {
      const v = normalizeLux(lux)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})
