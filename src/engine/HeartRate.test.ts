/**
 * Unit tests for the pure parser + normalizer in HeartRate.ts
 * The browser-bound bits (navigator.bluetooth, GATT lifecycle) are
 * covered by integration testing in a real BLE-capable browser; here
 * we only exercise the deterministic byte-decoding logic.
 */

import { describe, it, expect } from 'vitest'
import { parseHeartRate, normalizeBpm } from './HeartRate'

function makeView(bytes: number[]): DataView {
  const buf = new ArrayBuffer(bytes.length)
  const u8 = new Uint8Array(buf)
  bytes.forEach((b, i) => { u8[i] = b })
  return new DataView(buf)
}

describe('parseHeartRate', () => {
  it('returns 0 on empty buffer', () => {
    expect(parseHeartRate(makeView([]))).toBe(0)
  })

  it('decodes uint8 bpm when flag bit 0 is clear', () => {
    // flags = 0x00 (8-bit format), value = 72
    expect(parseHeartRate(makeView([0x00, 72]))).toBe(72)
  })

  it('decodes uint16 LE bpm when flag bit 0 is set', () => {
    // flags = 0x01 (16-bit format), value = 270 = 0x010E LE
    expect(parseHeartRate(makeView([0x01, 0x0e, 0x01]))).toBe(270)
  })

  it('returns 0 if 8-bit payload is truncated', () => {
    expect(parseHeartRate(makeView([0x00]))).toBe(0)
  })

  it('returns 0 if 16-bit payload is truncated', () => {
    expect(parseHeartRate(makeView([0x01, 0x0e]))).toBe(0)
  })

  it('ignores other flag bits (energy expended, RR intervals)', () => {
    // flags = 0x18 (energy expended + RR present, but bit 0 = 0 → 8-bit bpm)
    expect(parseHeartRate(makeView([0x18, 65]))).toBe(65)
  })
})

describe('normalizeBpm', () => {
  it('clamps to 0 at or below 60 bpm', () => {
    expect(normalizeBpm(60)).toBe(0)
    expect(normalizeBpm(45)).toBe(0)
    expect(normalizeBpm(0)).toBe(0)
  })

  it('clamps to 1 at or above 180 bpm', () => {
    expect(normalizeBpm(180)).toBe(1)
    expect(normalizeBpm(220)).toBe(1)
  })

  it('linearly interpolates between 60..180', () => {
    expect(normalizeBpm(120)).toBeCloseTo(0.5, 5)
    expect(normalizeBpm(90)).toBeCloseTo(0.25, 5)
    expect(normalizeBpm(150)).toBeCloseTo(0.75, 5)
  })
})
