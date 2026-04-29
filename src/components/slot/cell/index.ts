/**
 * Compound cell exports — public surface for the cell module.
 *
 * Most callers should keep using the legacy `<Cell>` orchestrator
 * (re-exported from `../Cell.tsx`) which composes the parts below.
 * These exports exist so a custom cell variant (animated demo,
 * waveform, etc.) can compose its own arrangement without forking
 * the orchestrator.
 *
 * Example custom variant:
 *   <CellShell data={data}>
 *     <CellBackground />
 *     <CellHologram>
 *       <AnimatedImage src={data.demoUrl!} />
 *     </CellHologram>
 *   </CellShell>
 */

export { CellContext, useCellContext } from './CellContext'
export { CellBackground } from './CellBackground'
export { CellContent } from './CellContent'

export { default as GameContent } from './contents/GameContent'
export { default as ScopeContent } from './contents/ScopeContent'
export { default as WorkContent } from './contents/WorkContent'
export { default as ToolsContent } from './contents/ToolsContent'
export { default as DemoContent } from './contents/DemoContent'
export { default as SimpleContent } from './contents/SimpleContent'
export { default as DetailContent } from './contents/DetailContent'
