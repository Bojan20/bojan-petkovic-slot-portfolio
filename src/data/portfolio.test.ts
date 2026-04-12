/**
 * Portfolio Data Tests
 */

import { describe, it, expect } from 'vitest'
import {
  PROJECTS,
  SKILLS_DATA,
  ABOUT_DATA,
  EXP_DATA,
  CONTACT_DATA,
  SECTIONS,
} from './portfolio'

describe('portfolio data', () => {
  it('has 5 sections', () => {
    expect(SECTIONS).toHaveLength(5)
  })

  it('has 8 projects', () => {
    expect(PROJECTS).toHaveLength(8)
  })

  it('has 6 skills', () => {
    expect(SKILLS_DATA).toHaveLength(6)
  })

  it('has 5 about entries', () => {
    expect(ABOUT_DATA).toHaveLength(5)
  })

  it('has 4 career entries', () => {
    expect(EXP_DATA).toHaveLength(6)
  })

  it('has 3 contact entries', () => {
    expect(CONTACT_DATA).toHaveLength(3)
  })

  it('every project has required fields', () => {
    for (const p of PROJECTS) {
      expect(p.ico).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.studio).toBeTruthy()
      expect(p.color).toBeTruthy()
      expect(p.tools.length).toBeGreaterThan(0)
    }
  })

  it('every skill has required fields', () => {
    for (const s of SKILLS_DATA) {
      expect(s.ico).toBeTruthy()
      expect(s.name).toBeTruthy()
      expect(s.desc).toBeTruthy()
      expect(s.tools.length).toBeGreaterThan(0)
    }
  })

  it('every section has numCols matching headers length', () => {
    for (const sec of SECTIONS) {
      expect(sec.numCols).toBe(sec.headers.length)
    }
  })

  it('projects section has 5 columns', () => {
    const proj = SECTIONS.find((s) => s.id === 'projects')!
    expect(proj.numCols).toBe(5)
    expect(proj.headers).toEqual(['GAME', 'SCOPE', 'THE WORK', 'TOOLS', 'DEMO'])
  })

  it('skills section has 3 columns', () => {
    const skills = SECTIONS.find((s) => s.id === 'skills')!
    expect(skills.numCols).toBe(3)
  })
})
