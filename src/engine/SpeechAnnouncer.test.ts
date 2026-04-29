/**
 * Unit tests for the voice scoring heuristic. The runtime Speech
 * Synthesis path is browser-bound and tested manually — here we
 * only check that the scorer prefers the voices we want it to.
 */

import { describe, it, expect } from 'vitest'
import { scoreVoice } from './SpeechAnnouncer'

function makeVoice(name: string, lang: string, localService = true): SpeechSynthesisVoice {
  return {
    name,
    lang,
    localService,
    default: false,
    voiceURI: `voice://${name}`,
  } as SpeechSynthesisVoice
}

describe('scoreVoice', () => {
  it('prefers en-GB over en-US over generic en', () => {
    const gb = scoreVoice(makeVoice('Generic', 'en-GB'))
    const us = scoreVoice(makeVoice('Generic', 'en-US'))
    const en = scoreVoice(makeVoice('Generic', 'en-AU'))
    expect(gb).toBeGreaterThan(us)
    expect(us).toBeGreaterThan(en)
  })

  it('penalizes non-English languages', () => {
    const en = scoreVoice(makeVoice('Voice', 'en-GB'))
    const sr = scoreVoice(makeVoice('Voice', 'sr-RS'))
    expect(en).toBeGreaterThan(sr)
  })

  it('boosts Daniel (macOS en-GB classic) above generic en-GB', () => {
    const generic = scoreVoice(makeVoice('Generic', 'en-GB'))
    const daniel = scoreVoice(makeVoice('Daniel', 'en-GB'))
    expect(daniel).toBeGreaterThan(generic)
  })

  it('boosts Alex above generic en-US', () => {
    const generic = scoreVoice(makeVoice('Generic', 'en-US'))
    const alex = scoreVoice(makeVoice('Alex', 'en-US'))
    expect(alex).toBeGreaterThan(generic)
  })

  it('penalizes "compact" voices', () => {
    const full = scoreVoice(makeVoice('Daniel', 'en-GB'))
    const compact = scoreVoice(makeVoice('Daniel (compact)', 'en-GB'))
    expect(compact).toBeLessThan(full)
  })

  it('rewards local voices over network ones', () => {
    const local = scoreVoice(makeVoice('Daniel', 'en-GB', true))
    const network = scoreVoice(makeVoice('Daniel', 'en-GB', false))
    expect(local).toBeGreaterThan(network)
  })

  it('Daniel en-GB beats Alex en-US (preferred classic)', () => {
    const daniel = scoreVoice(makeVoice('Daniel', 'en-GB'))
    const alex = scoreVoice(makeVoice('Alex', 'en-US'))
    expect(daniel).toBeGreaterThan(alex)
  })
})
