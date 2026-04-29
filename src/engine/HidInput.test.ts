/**
 * Unit tests for the pure helpers in HidInput.ts.
 * Browser-bound bits (navigator.hid, device pairing) require a real
 * Chromium with WebHID — covered by manual integration testing.
 */

import { describe, it, expect } from 'vitest'
import { anyByteNonZero, buttonsHash } from './HidInput'

function view(bytes: number[]): DataView {
  const buf = new ArrayBuffer(bytes.length)
  const u8 = new Uint8Array(buf)
  bytes.forEach((b, i) => { u8[i] = b })
  return new DataView(buf)
}

describe('anyByteNonZero', () => {
  it('returns false for an all-zero report', () => {
    expect(anyByteNonZero(view([0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false)
  })

  it('returns true if any of the first 8 bytes is non-zero', () => {
    expect(anyByteNonZero(view([0, 0, 0, 1, 0, 0, 0, 0]))).toBe(true)
    expect(anyByteNonZero(view([1]))).toBe(true)
    expect(anyByteNonZero(view([0, 0, 255]))).toBe(true)
  })

  it('ignores bytes past the first 8 (cap)', () => {
    // first 8 zero, byte 8 (9th) non-zero — should still report false
    const buf = new ArrayBuffer(10)
    new Uint8Array(buf)[8] = 0xff
    expect(anyByteNonZero(new DataView(buf))).toBe(false)
  })

  it('returns false on empty buffer', () => {
    expect(anyByteNonZero(view([]))).toBe(false)
  })
})

describe('buttonsHash', () => {
  it('returns 0 for an all-zero report', () => {
    expect(buttonsHash(view([0, 0, 0, 0]))).toBe(0)
  })

  it('produces stable hashes for identical inputs', () => {
    const a = buttonsHash(view([1, 2, 3, 4, 5]))
    const b = buttonsHash(view([1, 2, 3, 4, 5]))
    expect(a).toBe(b)
  })

  it('produces different hashes for different inputs', () => {
    const a = buttonsHash(view([1, 0, 0, 0]))
    const b = buttonsHash(view([0, 1, 0, 0]))
    expect(a).not.toBe(b)
  })

  it('always returns a non-negative integer (uint32)', () => {
    // High-bit input that would overflow signed int32
    const h = buttonsHash(view([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(0x1_0000_0000)
  })
})
