/**
 * Contact section strategy — 5 cols: CHANNEL | TYPE | VALUE | STATUS | NOTE.
 */

import type { CellData } from '../../../types'
import { CONTACT_DATA } from '../../../data'
import { type SectionStrategy, STRIP_ROWS, wrap, rowItemIndex } from './strategy'

export const contactStrategy: SectionStrategy = {
  itemCount: CONTACT_DATA.length,
  assemble(centerIdx) {
    const cols: CellData[][] = [[], [], [], [], []]
    for (let k = 0; k < STRIP_ROWS; k++) {
      const d = wrap(CONTACT_DATA, centerIdx - 3 + k)
      const isC = k === 3
      const itemIndex = rowItemIndex(CONTACT_DATA.length, centerIdx, k)
      cols[0]!.push({ type: 'simple', ico: d.ico, name: d.name, studio: '',     color: d.color, center: isC, itemIndex })
      cols[1]!.push({ type: 'detail', text: d.period || '',                     color: d.color, center: isC })
      cols[2]!.push({ type: 'detail', text: d.desc,                             color: d.color, center: isC })
      cols[3]!.push({ type: 'tools',  tools: d.highlights || [],                color: d.color, center: isC })
      cols[4]!.push({ type: 'detail', text: d.note || '',                       color: d.color, center: isC })
    }
    return cols
  },
}
