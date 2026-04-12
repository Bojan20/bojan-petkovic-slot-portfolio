export type SectionId = 'projects' | 'skills' | 'about' | 'career' | 'contact'
export type CellType = 'game' | 'scope' | 'work' | 'tools' | 'demo' | 'simple' | 'detail'

export interface SectionDef {
  id: SectionId
  label: string
  icon: string       // Tab icon symbol
  headers: string[]  // Column header labels
  headerIcons: string[] // Column header icon symbols
  numCols: number
}

export interface ProjectItem {
  ico: string
  name: string
  studio: string
  color: string  // ambient color #hex
  scope: { music: boolean; sfx: boolean; integration: boolean; qa: boolean }
  work: string
  tools: string[]
  demo: 'video' | 'audio' | null
  videoPath?: string
  musicPath?: string
  sfxPath?: string
}

export interface SkillItem {
  ico: string
  name: string
  desc: string
  tools: string[]
  color: string
}

export interface SimpleItem {
  ico: string
  name: string
  desc: string
  color: string
  period?: string      // for career — company period
  highlights?: string[] // for about — stat badges (col 2)
}

// A single visible reel cell (one row in one column)
export interface CellData {
  type: CellType
  center: boolean
  color: string
  // Type-specific payload
  // game
  ico?: string
  name?: string
  studio?: string
  itemIndex?: number
  // scope
  scope?: { music: boolean; sfx: boolean; integration: boolean; qa: boolean }
  // work
  text?: string
  // tools
  tools?: string[]
  // demo
  demo?: 'video' | 'audio' | null
  // simple (skills/about/career/contact)
  period?: string
}

export type SpinPhase = 'idle' | 'windup' | 'spinning' | 'landing' | 'snapping' | 'landed'
