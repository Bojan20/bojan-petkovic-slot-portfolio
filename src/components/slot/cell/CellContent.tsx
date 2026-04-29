/**
 * CellContent — content router that picks the right renderer based on
 * the cell's `data.type`. Replaces the polymorphic if/else block from
 * the legacy `Cell.tsx`.
 *
 * To add a new cell variant:
 *   1. Add the new type to `CellType` in src/types/portfolio.ts
 *   2. Create a new renderer under cell/contents/<Name>Content.tsx
 *   3. Add a case here
 * No edits to Cell.tsx, no widening of the public Cell API.
 */

import { useCellContext } from './CellContext'
import GameContent from './contents/GameContent'
import ScopeContent from './contents/ScopeContent'
import WorkContent from './contents/WorkContent'
import ToolsContent from './contents/ToolsContent'
import DemoContent from './contents/DemoContent'
import SimpleContent from './contents/SimpleContent'
import DetailContent from './contents/DetailContent'

export function CellContent() {
  const { data } = useCellContext()
  switch (data.type) {
    case 'game':   return <GameContent />
    case 'scope':  return <ScopeContent />
    case 'work':   return <WorkContent />
    case 'tools':  return <ToolsContent />
    case 'demo':   return <DemoContent />
    case 'simple': return <SimpleContent />
    case 'detail': return <DetailContent />
    default:
      return null
  }
}

export default CellContent
