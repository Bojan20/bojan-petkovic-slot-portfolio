/**
 * Portfolio Data — All reel content
 * Source: vanvinkl-concept-a7.html mockup
 */

import type { ProjectItem, SkillItem, SimpleItem, SectionDef } from '../types'

// ============================================================
// SECTIONS
// ============================================================

export const SECTIONS: SectionDef[] = [
  { id: 'projects', label: 'PROJECTS', icon: '◈', headers: ['GAME', 'SCOPE', 'THE WORK', 'TOOLS', 'DEMO'],   headerIcons: ['⬡', '◎', '◆', '⚙', '▶'], numCols: 5 },
  { id: 'skills',   label: 'SKILLS',   icon: '◉', headers: ['SKILL', 'DETAILS', 'TOOLS'],                    headerIcons: ['◈', '◎', '⚙'],           numCols: 3 },
  { id: 'about',    label: 'ABOUT',    icon: '◎', headers: ['PROFILE', 'DETAILS'],                           headerIcons: ['◈', '◎'],                 numCols: 2 },
  { id: 'career',   label: 'CAREER',   icon: '◆', headers: ['ROLE', 'DETAILS'],                              headerIcons: ['◆', '◎'],                 numCols: 2 },
  { id: 'contact',  label: 'CONTACT',  icon: '▶', headers: ['CHANNEL', 'DETAILS'],                           headerIcons: ['▶', '◎'],                 numCols: 2 },
]

// ============================================================
// PROJECTS (8)
// ============================================================

export const PROJECTS: ProjectItem[] = [
  {
    ico: '🐷',
    name: 'PIGGY PLUNGER',
    studio: 'Playnetic · 2025',
    color: '#ff69b4',
    scope: { music: true, sfx: true, integration: true, qa: true },
    work: 'Bouncy ragtime score, 4 adaptive layers. 200+ custom SFX — reel hits, coin cascades, plunger mechanics.',
    tools: ['Logic Pro', 'iZotope RX', 'Howler.js', 'Phaser 3'],
    demo: 'video',
  },
  {
    ico: '⚡',
    name: 'SMASH FACTORY',
    studio: 'Playnetic · 2025',
    color: '#ff8c00',
    scope: { music: true, sfx: true, integration: true, qa: false },
    work: 'Industrial metal theme — tension/euphoria transitions. Hydraulic SFX palette: metal impacts, sparks, electricity.',
    tools: ['Logic Pro', 'Reaper', 'Howler.js', 'Phaser 3'],
    demo: 'video',
  },
  {
    ico: '✨',
    name: 'STARLIGHT TRAVELERS',
    studio: 'Playnetic · 2025',
    color: '#6a5acd',
    scope: { music: true, sfx: true, integration: true, qa: true },
    work: 'Ethereal cosmic soundscape — shimmering synths, crystalline wins, nebula ambience, stardust audio.',
    tools: ['Logic Pro', 'iZotope', 'Howler.js', 'Phaser 3'],
    demo: 'video',
  },
  {
    ico: '⚔️',
    name: 'VALKYRIES',
    studio: 'Playnetic · 2025',
    color: '#dc143c',
    scope: { music: true, sfx: true, integration: true, qa: false },
    work: 'Nordic war theme — epic choir, war drums, dynamic free spin escalation. Shield clashes, battle ambience.',
    tools: ['Logic Pro', 'FMOD', 'Reaper', 'Phaser 3'],
    demo: 'audio',
  },
  {
    ico: '🐲',
    name: 'ZHULONGS',
    studio: 'IGT · 2023',
    color: '#00c853',
    scope: { music: true, sfx: true, integration: false, qa: true },
    work: 'Pentatonic orchestral — Chinese classical meets casino energy. Dragon roars, gong hits, mystical effects.',
    tools: ['Logic Pro', 'Pro Tools', 'iZotope', 'Unity'],
    demo: 'audio',
  },
  {
    ico: '🌙',
    name: 'MIDNIGHT GOLD',
    studio: 'VanVinkl · 2024',
    color: '#1e90ff',
    scope: { music: true, sfx: true, integration: true, qa: true },
    work: 'Dark jazz lounge with gold-rush anticipation builds. Velvet UI sounds, sax stingers, coin rain FX.',
    tools: ['Logic Pro', 'Reaper', 'Howler.js', 'Phaser 3'],
    demo: 'audio',
  },
  {
    ico: '🔥',
    name: "BLAZIN'S HOT",
    studio: 'IGT · 2022',
    color: '#ff4500',
    scope: { music: true, sfx: true, integration: false, qa: true },
    work: 'Upbeat Mediterranean melody — tension ramp for free spins. Fire crackles, sizzling wins, pepper explosions.',
    tools: ['Pro Tools', 'Logic Pro', 'iZotope', 'Unity'],
    demo: 'audio',
  },
  {
    ico: '🏺',
    name: 'MUMMY RICHES',
    studio: 'Playnetic · 2024',
    color: '#daa520',
    scope: { music: true, sfx: true, integration: true, qa: false },
    work: 'Egyptian mystery — haunting flutes, sandy winds, tomb ambience. Scarab beetles, sand cascades, ancient SFX.',
    tools: ['Logic Pro', 'iZotope RX', 'Howler.js', 'Phaser 3'],
    demo: 'audio',
  },
]

// ============================================================
// SKILLS (6)
// ============================================================

export const SKILLS_DATA: SkillItem[] = [
  {
    ico: '🎰',
    name: 'SLOT AUDIO',
    desc: 'Full sonic identity — base ambience through free spins to jackpot celebration. 50+ titles shipped.',
    tools: ['FMOD', 'Wwise', 'Howler.js'],
    color: '#ffd700',
  },
  {
    ico: '🎵',
    name: 'COMPOSITION',
    desc: 'Adaptive layered music that follows game state in real time — loops, stingers, dynamic transitions.',
    tools: ['Logic Pro', 'Reaper', 'Kontakt'],
    color: '#00e5ff',
  },
  {
    ico: '🔊',
    name: 'SOUND DESIGN',
    desc: 'Custom SFX libraries — reel mechanics, wins, UI feedback, ambience, transition effects.',
    tools: ['iZotope RX', 'Logic Pro', 'Reaper'],
    color: '#ff00aa',
  },
  {
    ico: '⚙️',
    name: 'INTEGRATION',
    desc: 'Wiring audio into Phaser, Unity, PixiJS with event-driven playback logic.',
    tools: ['Phaser 3', 'Unity', 'PixiJS'],
    color: '#00ff88',
  },
  {
    ico: '🧪',
    name: 'AUDIO QA',
    desc: 'Systematic trigger verification across all game states before release.',
    tools: ['JIRA', 'TestRail', 'Custom'],
    color: '#9944ff',
  },
  {
    ico: '🎛️',
    name: 'DIRECTION',
    desc: 'Creative lead — from brief to delivery. Team mentoring. Quality standards.',
    tools: ['Confluence', 'Figma', 'Slack'],
    color: '#ff6600',
  },
]

// ============================================================
// ABOUT (5)
// ============================================================

export const ABOUT_DATA: SimpleItem[] = [
  {
    ico: '🏆',
    name: '10+ YEARS',
    desc: 'Over a decade crafting audio for slot & mobile games.',
    color: '#ffd700',
  },
  {
    ico: '🎰',
    name: '50+ TITLES',
    desc: 'Fifty released games carrying my audio DNA across global markets.',
    color: '#00e5ff',
  },
  {
    ico: '🏛️',
    name: 'IGT · PLAYNETIC',
    desc: 'Senior roles at two industry-leading slot studios.',
    color: '#ff00aa',
  },
  {
    ico: '🌍',
    name: 'GLOBAL MARKETS',
    desc: 'EU, UK, North America, AUS — regulated market experience.',
    color: '#00ff88',
  },
  {
    ico: '🎓',
    name: 'SAE GRADUATE',
    desc: 'Audio Engineering diploma. BA Music Performance.',
    color: '#9944ff',
  },
]

// ============================================================
// CAREER (4)
// ============================================================

export const EXP_DATA: SimpleItem[] = [
  {
    ico: '🌐',
    name: 'VANVINKL',
    desc: 'Founder & Audio Director — Full-service iGaming audio production.',
    color: '#00e5ff',
    period: '2024→NOW',
  },
  {
    ico: '🎮',
    name: 'PLAYNETIC',
    desc: 'Audio Producer, Lead Sound Designer — 10+ parallel slot titles.',
    color: '#ffd700',
    period: '2024→2026',
  },
  {
    ico: '🏛️',
    name: 'IGT',
    desc: 'Senior Sound Designer, Audio Lead — team of 3, EU regulated.',
    color: '#ff00aa',
    period: '2020→2024',
  },
  {
    ico: '🎓',
    name: 'EDUCATION',
    desc: 'Audio Production Diploma + BA Accordion & Piano Performance.',
    color: '#9944ff',
    period: 'SAE+BA',
  },
]

// ============================================================
// CONTACT (3)
// ============================================================

export const CONTACT_DATA: SimpleItem[] = [
  {
    ico: '📧',
    name: 'EMAIL',
    desc: 'bojan@vanvinkl.com',
    color: '#ffd700',
  },
  {
    ico: '💼',
    name: 'LINKEDIN',
    desc: 'linkedin.com/in/vanvinkl',
    color: '#0077b5',
  },
  {
    ico: '✅',
    name: 'AVAILABLE',
    desc: 'Freelance, contract, full-time — remote worldwide.',
    color: '#00ff88',
  },
]
