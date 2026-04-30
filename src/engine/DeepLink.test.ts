/**
 * DeepLink — V7.1 unit tests
 *
 * Pure parser / builder coverage. Live URL sync is integration-tested
 * via manual browser sessions (history API can't be exercised cleanly
 * in jsdom without spamming hashchange listeners we don't own).
 */

import { describe, it, expect } from 'vitest'
import { parseHash, buildHash, shareableUrl } from './DeepLink'

describe('parseHash', () => {
  it('returns null for empty / missing hash', () => {
    expect(parseHash('')).toBeNull()
    expect(parseHash('#')).toBeNull()
    expect(parseHash('#/')).toBeNull()
  })

  it('parses canonical #/section/idx form', () => {
    expect(parseHash('#/projects/2')).toEqual({
      sectionId: 'projects',
      itemIdx: 2,
      wantDetail: false,
    })
  })

  it('parses non-canonical #section/idx (no leading slash)', () => {
    expect(parseHash('#projects/2')).toEqual({
      sectionId: 'projects',
      itemIdx: 2,
      wantDetail: false,
    })
  })

  it('defaults itemIdx to 0 when omitted', () => {
    expect(parseHash('#/about')).toEqual({
      sectionId: 'about',
      itemIdx: 0,
      wantDetail: false,
    })
  })

  it('flags wantDetail when /detail tail present', () => {
    expect(parseHash('#/skills/0/detail')).toEqual({
      sectionId: 'skills',
      itemIdx: 0,
      wantDetail: true,
    })
  })

  it('rejects unknown section ids', () => {
    expect(parseHash('#/bogus/0')).toBeNull()
    expect(parseHash('#/PROJECTS/0')).toBeNull() // case-sensitive
  })

  it('rejects non-numeric itemIdx', () => {
    expect(parseHash('#/projects/abc')).toBeNull()
  })

  it('rejects negative or absurd itemIdx', () => {
    expect(parseHash('#/projects/-1')).toBeNull()
    expect(parseHash('#/projects/9999')).toBeNull()
  })

  it('all five canonical sections parse', () => {
    for (const id of ['projects', 'skills', 'about', 'career', 'contact'] as const) {
      const r = parseHash(`#/${id}/0`)
      expect(r?.sectionId).toBe(id)
    }
  })
})

describe('buildHash', () => {
  it('emits canonical #/section/idx', () => {
    expect(buildHash({ sectionId: 'projects', itemIdx: 3, wantDetail: false }))
      .toBe('#/projects/3')
  })

  it('appends /detail when flag set', () => {
    expect(buildHash({ sectionId: 'contact', itemIdx: 0, wantDetail: true }))
      .toBe('#/contact/0/detail')
  })

  it('round-trips parse → build → parse', () => {
    const original = '#/career/4/detail'
    const parsed = parseHash(original)!
    const rebuilt = buildHash(parsed)
    expect(rebuilt).toBe(original)
    expect(parseHash(rebuilt)).toEqual(parsed)
  })
})

describe('shareableUrl', () => {
  it('prepends origin + pathname when window present', () => {
    // jsdom default: http://localhost/
    const url = shareableUrl({ sectionId: 'projects', itemIdx: 1, wantDetail: false })
    expect(url).toMatch(/^https?:\/\/[^/]+\/.*#\/projects\/1$/)
  })
})
