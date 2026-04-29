/**
 * CellContext — shared cell data provider for the compound component tree.
 *
 * The compound `<Cell>` API exposes Background / Content / Foreground /
 * Hologram subcomponents that all need access to the same `CellData`
 * payload. Rather than threading props through every level we publish
 * the data once via Context and let consumers read it.
 *
 * This Context is internal to the cell module — external callers should
 * never reach into it. Public API is the `<Cell>` orchestrator and its
 * compound exports.
 */

import { createContext, useContext } from 'react'
import type { CellData } from '../../../types'

interface CellContextValue {
  data: CellData
  /** True when this cell is the visible center row (winning line). */
  isCenter: boolean
}

export const CellContext = createContext<CellContextValue | null>(null)

/** Hook for cell subcomponents. Throws if used outside <Cell>. */
export function useCellContext(): CellContextValue {
  const v = useContext(CellContext)
  if (!v) {
    throw new Error('Cell subcomponent used outside <Cell> — wrap inside Cell.')
  }
  return v
}
