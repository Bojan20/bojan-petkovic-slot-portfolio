/**
 * Projects section strategy — 5 cols: GAME | SCOPE | WORK | TOOLS | DEMO.
 * Carries the row-excitement scorer that drives anticipation reels +
 * slot:win bucketing.
 */

import type { CellData } from '../../../types'
import { PROJECTS } from '../../../data'
import { type SectionStrategy, STRIP_ROWS, wrap, rowItemIndex } from './strategy'

function rowExcitement(itemIdx: number): number {
  const p = PROJECTS[itemIdx]
  if (!p) return 0
  let score = 0
  if (p.scope.music)       score += 1
  if (p.scope.sfx)         score += 1
  if (p.scope.integration) score += 1
  if (p.scope.qa)          score += 1
  if (p.demo)              score += 1
  return score / 5
}

export const projectsStrategy: SectionStrategy = {
  itemCount: PROJECTS.length,
  rowExcitement,
  assemble(centerIdx) {
    const cols: CellData[][] = [[], [], [], [], []]
    for (let k = 0; k < STRIP_ROWS; k++) {
      const p = wrap(PROJECTS, centerIdx - 3 + k)
      const isC = k === 3
      const itemIndex = rowItemIndex(PROJECTS.length, centerIdx, k)
      cols[0]!.push({ type: 'game',   ico: p.ico, name: p.name, studio: p.studio, color: p.color, center: isC, itemIndex })
      cols[1]!.push({ type: 'scope',  scope: p.scope, color: p.color, center: isC })
      cols[2]!.push({ type: 'detail', text: p.work,    color: p.color, center: isC })
      cols[3]!.push({ type: 'tools',  tools: p.tools,  color: p.color, center: isC })
      cols[4]!.push({ type: 'demo',   demo: p.demo,    color: p.color, center: isC })
    }
    return cols
  },
}
