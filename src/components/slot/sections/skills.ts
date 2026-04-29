/**
 * Skills section strategy — 5 cols: SKILL | LEVEL | DETAILS | TOOLS | DOMAIN.
 */

import type { CellData } from '../../../types'
import { SKILLS_DATA } from '../../../data'
import { type SectionStrategy, STRIP_ROWS, wrap, rowItemIndex } from './strategy'

export const skillsStrategy: SectionStrategy = {
  itemCount: SKILLS_DATA.length,
  assemble(centerIdx) {
    const cols: CellData[][] = [[], [], [], [], []]
    for (let k = 0; k < STRIP_ROWS; k++) {
      const s = wrap(SKILLS_DATA, centerIdx - 3 + k)
      const isC = k === 3
      const itemIndex = rowItemIndex(SKILLS_DATA.length, centerIdx, k)
      cols[0]!.push({ type: 'simple', ico: s.ico, name: s.name, studio: '', color: s.color, center: isC, itemIndex })
      cols[1]!.push({ type: 'tools',  tools: [s.level], color: s.color, center: isC })
      cols[2]!.push({ type: 'detail', text: s.desc,     color: s.color, center: isC })
      cols[3]!.push({ type: 'tools',  tools: s.tools,   color: s.color, center: isC })
      cols[4]!.push({ type: 'tools',  tools: [s.domain], color: s.color, center: isC })
    }
    return cols
  },
}
