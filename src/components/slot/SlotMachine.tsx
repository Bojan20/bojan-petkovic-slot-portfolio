/**
 * SlotMachine — Main orchestrator component
 *
 * Assembles: Header → TabBar → Frame → ReelColumns → SpinButton
 * Manages spin lifecycle, cell data, and audio triggers.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useSlotStore } from '../../store'
import { getCellsByCategory, TABS } from '../../data'
import { shuffleCells, REEL_COLS, REEL_ROWS } from '../../features/reel'
import { unlockAudio, playSpinStart, playReelLand, playWinFanfare } from '../../features/audio'
import type { ReelCell, PortfolioCategory } from '../../types'
import Header from './Header'
import TabBar from './TabBar'
import Frame from './Frame'
import ReelColumn from './ReelColumn'
import SpinButton from './SpinButton'
import styles from './SlotMachine.module.css'

export default function SlotMachine() {
  const {
    activeTab,
    setActiveTab,
    isSpinning,
    setSpinning,
    credits,
    jackpot,
    tickJackpot,
  } = useSlotStore()

  // Column refs for GSAP (future use when spin animation connects)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])

  // Current displayed cells per column (3 rows each)
  const [displayCells, setDisplayCells] = useState<ReelCell[][]>(() =>
    buildInitialGrid(activeTab)
  )

  // Selected cell for portfolio player
  const [_selectedCell, setSelectedCell] = useState<ReelCell | null>(null)

  /** Build a 5×3 grid from available cells */
  function buildInitialGrid(tab: PortfolioCategory): ReelCell[][] {
    const pool = getCellsByCategory(tab)
    if (pool.length === 0) return Array.from({ length: REEL_COLS }, () => [])

    const shuffled = shuffleCells(pool)
    const grid: ReelCell[][] = []

    for (let col = 0; col < REEL_COLS; col++) {
      const column: ReelCell[] = []
      for (let row = 0; row < REEL_ROWS; row++) {
        const idx = (col * REEL_ROWS + row) % shuffled.length
        column.push(shuffled[idx]!)
      }
      grid.push(column)
    }
    return grid
  }

  /** Handle tab change — reshuffle grid */
  const handleTabChange = useCallback(
    (tab: PortfolioCategory) => {
      if (isSpinning) return
      setActiveTab(tab)
      setDisplayCells(buildInitialGrid(tab))
    },
    [isSpinning, setActiveTab]
  )

  /** Handle spin */
  const handleSpin = useCallback(async () => {
    if (isSpinning) return

    // Unlock audio on first interaction
    await unlockAudio()

    setSpinning(true)
    playSpinStart()
    tickJackpot()

    // Simulate spin: shuffle after delay, then land
    // TODO: Replace with full GSAP spinAllColumns animation
    setTimeout(() => {
      setDisplayCells(buildInitialGrid(activeTab))

      // Staggered land sounds
      for (let i = 0; i < REEL_COLS; i++) {
        setTimeout(() => playReelLand(i), i * 180)
      }

      // All landed
      setTimeout(() => {
        setSpinning(false)
        playWinFanfare()
      }, REEL_COLS * 180 + 100)
    }, 1200)
  }, [isSpinning, activeTab, setSpinning, tickJackpot])

  /** Handle cell click (center row only) */
  const handleCellClick = useCallback((cell: ReelCell) => {
    if (cell.hasDemo) {
      setSelectedCell(cell)
      // TODO: Open portfolio player
      console.log('[SlotMachine] Open demo:', cell.title)
    }
  }, [])

  /** Memoize tabs */
  const tabs = useMemo(() => TABS, [])

  return (
    <div className={styles.machine}>
      {/* Header: Credits / Title / Jackpot */}
      <Header credits={credits} jackpot={jackpot} />

      {/* Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        disabled={isSpinning}
      />

      {/* Frame + Reels */}
      <div className={styles.frameWrapper}>
        <Frame>
          <div className={styles.reelGrid}>
            {displayCells.map((cells, colIdx) => (
              <ReelColumn
                key={colIdx}
                ref={(el) => { columnRefs.current[colIdx] = el }}
                cells={cells}
                columnIndex={colIdx}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </Frame>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <SpinButton isSpinning={isSpinning} onClick={handleSpin} />
      </div>

      {/* Bottom strip */}
      <div className={styles.bottomStrip}>
        <span className={styles.brand}>VANVINKL STUDIO</span>
        <span className={styles.coin}>🪙</span>
        <span className={styles.jpLabel}>
          bojan@vanvinkl.com · linkedin.com/in/vanvinkl
        </span>
      </div>
    </div>
  )
}
