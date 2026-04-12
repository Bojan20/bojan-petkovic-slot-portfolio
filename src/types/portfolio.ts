/**
 * Portfolio Data Types
 *
 * Core type definitions for slot reel content, projects, and categories.
 */

/** A single cell in the slot reel */
export interface ReelCell {
  /** Emoji icon displayed in the cell */
  icon: string
  /** Game/project name — primary text */
  title: string
  /** Role or contribution — secondary text */
  role: string
  /** Year of work */
  year: string
  /** Technology tags shown as badges */
  tags: string[]
  /** Portfolio category for filtering */
  category: PortfolioCategory
  /** Whether this cell has a playable demo */
  hasDemo: boolean
  /** Path to video file (if video demo) */
  videoPath?: string
  /** Path to music track (if audio demo) */
  musicPath?: string
  /** Path to SFX track (if audio demo) */
  sfxPath?: string
  /** Multiple audio tracks for audio-only projects */
  audioTracks?: AudioTrack[]
  /** Brief description for the portfolio player */
  description: string
}

export interface AudioTrack {
  label: string
  path: string
}

/** Portfolio categories — each maps to a tab */
export type PortfolioCategory =
  | 'games'
  | 'audio'
  | 'frontend'
  | 'tools'
  | 'all'

/** Tab definition for the category switcher */
export interface TabDef {
  id: PortfolioCategory
  label: string
  icon: string
}

/** Reel column configuration */
export interface ReelColumn {
  /** Column index (0-4 for 5-column layout) */
  index: number
  /** Cells in this column (visible rows) */
  cells: ReelCell[]
  /** Current scroll offset for animation */
  offset: number
  /** Whether this column is currently spinning */
  spinning: boolean
}

/** Slot machine state */
export interface SlotState {
  /** All 5 reel columns */
  columns: ReelColumn[]
  /** Currently active tab/filter */
  activeTab: PortfolioCategory
  /** Whether a spin is in progress */
  isSpinning: boolean
  /** Center row cells (the "winning" line) */
  centerRow: ReelCell[]
  /** Credits counter (decorative) */
  credits: number
  /** Jackpot counter (decorative) */
  jackpot: number
}

/** Spin phase for GSAP timeline */
export type SpinPhase =
  | 'idle'
  | 'accelerating'
  | 'full-speed'
  | 'bouncing'
  | 'landed'
