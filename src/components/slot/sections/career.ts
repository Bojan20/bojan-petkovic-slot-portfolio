/**
 * Career section strategy — 5 cols: COMPANY | PERIOD | ROLE | SCOPE | IMPACT.
 */

import type { CellData } from '../../../types'
import { EXP_DATA } from '../../../data'
import { type SectionStrategy, STRIP_ROWS, wrap, rowItemIndex } from './strategy'

export const careerStrategy: SectionStrategy = {
  itemCount: EXP_DATA.length,
  assemble(centerIdx) {
    const cols: CellData[][] = [[], [], [], [], []]
    for (let k = 0; k < STRIP_ROWS; k++) {
      const d = wrap(EXP_DATA, centerIdx - 3 + k)
      const isC = k === 3
      const itemIndex = rowItemIndex(EXP_DATA.length, centerIdx, k)
      cols[0]!.push({ type: 'simple', ico: d.ico, name: d.name, studio: '',       color: d.color, center: isC, itemIndex })
      cols[1]!.push({ type: 'detail', text: d.period || '',                       color: d.color, center: isC })
      cols[2]!.push({ type: 'detail', text: d.desc,                               color: d.color, center: isC })
      cols[3]!.push({ type: 'tools',  tools: (d.highlights || []).slice(0, 2),    color: d.color, center: isC })
      cols[4]!.push({ type: 'tools',  tools: (d.highlights || []).slice(2),       color: d.color, center: isC })
    }
    return cols
  },
}
