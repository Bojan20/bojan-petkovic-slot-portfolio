/**
 * Portfolio Data — All reel cell content
 *
 * Source: vanvinkl-concept-a7.html mockup
 * 5 tabs: PROJECTS, SKILLS, ABOUT, CAREER, CONTACT
 */

import type { ReelCell, TabDef } from '../types'

// ============================================================
// TABS
// ============================================================

export const TABS: TabDef[] = [
  { id: 'all', label: 'ALL', icon: '🎰' },
  { id: 'games', label: 'PROJECTS', icon: '🎮' },
  { id: 'audio', label: 'SKILLS', icon: '🎵' },
  { id: 'frontend', label: 'ABOUT', icon: '👤' },
  { id: 'tools', label: 'CAREER', icon: '💼' },
]

// ============================================================
// PROJECT CELLS (Tab: PROJECTS)
// ============================================================

export const PROJECT_CELLS: ReelCell[] = [
  {
    icon: '🐷',
    title: 'PIGGY PLUNGER',
    role: 'Playnetic · 2025',
    year: '2025',
    tags: ['FMOD', 'Wwise', 'PixiJS'],
    category: 'games',
    hasDemo: true,
    description: 'Bouncy ragtime, 200+ SFX, adaptive music layers',
  },
  {
    icon: '🏭',
    title: 'SMASH FACTORY',
    role: 'Playnetic · 2025',
    year: '2025',
    tags: ['FMOD', 'PixiJS', 'Spine'],
    category: 'games',
    hasDemo: true,
    description: 'Industrial metal theme, percussive SFX design',
  },
  {
    icon: '🌌',
    title: 'STARLIGHT TRAVELERS',
    role: 'Playnetic · 2025',
    year: '2025',
    tags: ['Wwise', 'WebAudio', 'PixiJS'],
    category: 'games',
    hasDemo: true,
    description: 'Cosmic soundscape, ethereal pads, adaptive layers',
  },
  {
    icon: '⚔️',
    title: 'VALKYRIES',
    role: 'Playnetic · 2025',
    year: '2025',
    tags: ['FMOD', 'Orchestra', 'PixiJS'],
    category: 'games',
    hasDemo: true,
    description: 'Nordic war theme, epic brass, battle percussion',
  },
  {
    icon: '🐉',
    title: 'ZHULONGS',
    role: 'IGT · 2023',
    year: '2023',
    tags: ['Unity', 'Wwise', 'C#'],
    category: 'games',
    hasDemo: true,
    description: 'Pentatonic orchestral, Chinese cultural motifs',
  },
  {
    icon: '🌙',
    title: 'MIDNIGHT GOLD',
    role: 'VanVinkl · 2024',
    year: '2024',
    tags: ['WebAudio', 'Tone.js', 'React'],
    category: 'games',
    hasDemo: true,
    description: 'Dark jazz lounge, smoky saxophone, vinyl crackle',
  },
  {
    icon: '🔥',
    title: "BLAZIN'S HOT",
    role: 'IGT · 2022',
    year: '2022',
    tags: ['Unity', 'FMOD', 'C#'],
    category: 'games',
    hasDemo: true,
    description: 'Mediterranean melody, flamenco guitar, warm brass',
  },
  {
    icon: '🏛️',
    title: 'MUMMY RICHES',
    role: 'Playnetic · 2024',
    year: '2024',
    tags: ['FMOD', 'PixiJS', 'Spine'],
    category: 'games',
    hasDemo: true,
    description: 'Egyptian mystery, ancient percussion, mystical pads',
  },
]

// ============================================================
// SKILL CELLS (Tab: SKILLS)
// ============================================================

export const SKILL_CELLS: ReelCell[] = [
  {
    icon: '🎰',
    title: 'SLOT AUDIO',
    role: 'Full sonic identity for 50+ titles',
    year: '',
    tags: ['FMOD', 'Wwise', 'Pro Tools'],
    category: 'audio',
    hasDemo: false,
    description: 'Complete audio production for slot games — music, SFX, integration',
  },
  {
    icon: '🎼',
    title: 'COMPOSITION',
    role: 'Adaptive layered music systems',
    year: '',
    tags: ['Logic Pro', 'Cubase', 'Ableton'],
    category: 'audio',
    hasDemo: false,
    description: 'Adaptive layered music, thematic scoring, genre versatility',
  },
  {
    icon: '🔊',
    title: 'SOUND DESIGN',
    role: 'Custom SFX libraries & processing',
    year: '',
    tags: ['Synthesis', 'Foley', 'Processing'],
    category: 'audio',
    hasDemo: false,
    description: 'Custom SFX libraries, procedural audio, Foley recording',
  },
  {
    icon: '🔌',
    title: 'INTEGRATION',
    role: 'Phaser, Unity, PixiJS audio pipelines',
    year: '',
    tags: ['Phaser', 'Unity', 'PixiJS'],
    category: 'audio',
    hasDemo: false,
    description: 'Game engine audio integration, middleware setup, optimization',
  },
  {
    icon: '✅',
    title: 'AUDIO QA',
    role: 'Systematic trigger verification',
    year: '',
    tags: ['Testing', 'Automation', 'CI/CD'],
    category: 'audio',
    hasDemo: false,
    description: 'Systematic audio QA, trigger verification, cross-platform testing',
  },
  {
    icon: '🎯',
    title: 'DIRECTION',
    role: 'Creative lead & mentoring',
    year: '',
    tags: ['Leadership', 'Mentoring', 'Strategy'],
    category: 'audio',
    hasDemo: false,
    description: 'Audio team leadership, creative direction, mentoring junior designers',
  },
]

// ============================================================
// ABOUT CELLS (Tab: ABOUT)
// ============================================================

export const ABOUT_CELLS: ReelCell[] = [
  {
    icon: '🏆',
    title: '10+ YEARS',
    role: 'Professional audio experience',
    year: '',
    tags: ['Senior', 'Lead', 'Director'],
    category: 'frontend',
    hasDemo: false,
    description: 'Over a decade in professional game audio production',
  },
  {
    icon: '🎮',
    title: '50+ TITLES',
    role: 'Shipped across all platforms',
    year: '',
    tags: ['Mobile', 'Desktop', 'Console'],
    category: 'frontend',
    hasDemo: false,
    description: '50+ slot titles shipped to production worldwide',
  },
  {
    icon: '💼',
    title: 'SENIOR ROLES',
    role: 'IGT & Playnetic leadership',
    year: '',
    tags: ['IGT', 'Playnetic', 'VanVinkl'],
    category: 'frontend',
    hasDemo: false,
    description: 'Senior Sound Designer at IGT, Audio Producer at Playnetic',
  },
  {
    icon: '🌍',
    title: 'GLOBAL MARKETS',
    role: 'EU, UK, N.America, Australia',
    year: '',
    tags: ['Regulated', 'Multi-region', 'Compliance'],
    category: 'frontend',
    hasDemo: false,
    description: 'Delivered audio for global regulated gaming markets',
  },
  {
    icon: '🎓',
    title: 'SAE GRADUATE',
    role: 'Audio Engineering + BA Music',
    year: '',
    tags: ['SAE', 'BA', 'Accordion & Piano'],
    category: 'frontend',
    hasDemo: false,
    description: 'SAE Institute graduate, BA in Music (Accordion & Piano)',
  },
]

// ============================================================
// CAREER CELLS (Tab: CAREER)
// ============================================================

export const CAREER_CELLS: ReelCell[] = [
  {
    icon: '🏠',
    title: 'VANVINKL',
    role: '2024 → NOW',
    year: '2024',
    tags: ['Founder', 'Audio Director'],
    category: 'tools',
    hasDemo: false,
    description: 'Founder & Audio Director — VanVinkl Studio',
  },
  {
    icon: '🎮',
    title: 'PLAYNETIC',
    role: '2024 → 2026',
    year: '2024',
    tags: ['Audio Producer', 'Lead Sound Designer'],
    category: 'tools',
    hasDemo: false,
    description: 'Audio Producer, Lead Sound Designer — Playnetic',
  },
  {
    icon: '🏢',
    title: 'IGT',
    role: '2020 → 2024',
    year: '2020',
    tags: ['Senior Sound Designer', 'Audio Lead'],
    category: 'tools',
    hasDemo: false,
    description: 'Senior Sound Designer, Audio Lead — IGT (4 years)',
  },
  {
    icon: '🎓',
    title: 'EDUCATION',
    role: 'SAE Institute + BA',
    year: '',
    tags: ['Audio Engineering', 'Music Performance'],
    category: 'tools',
    hasDemo: false,
    description: 'SAE Institute — Audio Engineering, BA — Accordion & Piano',
  },
]

// ============================================================
// ALL CELLS (combined)
// ============================================================

export const ALL_CELLS: ReelCell[] = [
  ...PROJECT_CELLS,
  ...SKILL_CELLS,
  ...ABOUT_CELLS,
  ...CAREER_CELLS,
]

/**
 * Get cells filtered by category.
 */
export function getCellsByCategory(category: string): ReelCell[] {
  if (category === 'all') return ALL_CELLS
  return ALL_CELLS.filter((c) => c.category === category)
}
