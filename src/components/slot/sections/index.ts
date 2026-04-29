/**
 * Section strategy registry — public API.
 *
 * SlotMachine looks up its strategies through `STRATEGIES[secId]`.
 * Each strategy file is self-contained: data import + assemble logic
 * + optional excitement scorer. Adding a section is one-line in
 * the registry below + one new file.
 */

import type { SectionId } from '../../../types'
import type { StrategyRegistry } from './strategy'
import { projectsStrategy } from './projects'
import { skillsStrategy }   from './skills'
import { aboutStrategy }    from './about'
import { careerStrategy }   from './career'
import { contactStrategy }  from './contact'

export const STRATEGIES: StrategyRegistry = {
  projects: projectsStrategy,
  skills:   skillsStrategy,
  about:    aboutStrategy,
  career:   careerStrategy,
  contact:  contactStrategy,
}

export function getStrategy(secId: SectionId | undefined) {
  return secId ? STRATEGIES[secId] : undefined
}

export type { SectionStrategy } from './strategy'
