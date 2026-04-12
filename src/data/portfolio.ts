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
  { id: 'about',    label: 'ABOUT',    icon: '◎', headers: ['PROFILE', 'STORY', 'HIGHLIGHTS'],               headerIcons: ['◈', '◎', '◆'],            numCols: 3 },
  { id: 'career',   label: 'CAREER',   icon: '◆', headers: ['COMPANY', 'ROLE & SCOPE', 'KEY MILESTONES'],    headerIcons: ['◆', '◎', '★'],             numCols: 3 },
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
// ABOUT (7 aspects — one per reel row)
// Col 0: PROFILE (simple — icon + role + subtitle)
// Col 1: STORY   (detail — bio paragraph)
// Col 2: STATS   (tools — stat/highlight badges)
// ============================================================

export const ABOUT_DATA: SimpleItem[] = [
  {
    ico: '🎵',
    name: 'AUDIO PRODUCER',
    period: 'Senior · Full Pipeline',
    desc: '8+ years in slot and interactive game audio. Full pipeline ownership — concept, composition, implementation logic, QA, and final release preparation.',
    highlights: ['8+ YEARS', '50+ TITLES', 'FULL PIPELINE', 'REAL MONEY'],
    color: '#ffd700',
  },
  {
    ico: '🔊',
    name: 'SOUND DESIGNER',
    period: 'Custom Libraries · FX',
    desc: '200+ custom SFX assets per title — reel mechanics, coin physics, win escalation, ambience layers. Every asset purpose-built from scratch for the game.',
    highlights: ['200+ SFX/TITLE', 'CUSTOM LIBRARIES', 'TRIGGER LOGIC', 'QA VALIDATED'],
    color: '#00e5ff',
  },
  {
    ico: '🎼',
    name: 'COMPOSER',
    period: 'Adaptive Music · State Sync',
    desc: 'Adaptive layered music systems — base game, free spins, feature escalation. Seamless state transitions timed to volatility flow and player engagement.',
    highlights: ['ADAPTIVE LAYERS', 'STATE SYNC', 'LONG-SESSION', 'FEATURE RAMP'],
    color: '#9944ff',
  },
  {
    ico: '🎛️',
    name: 'AUDIO DIRECTOR',
    period: 'Creative Lead · Standards',
    desc: 'Creative direction across full titles — defined audio identity, set quality standards, supervised mix, validated all game states before final sign-off.',
    highlights: ['CREATIVE DIR.', 'MIX SUPERVISION', 'FINAL DELIVERY', 'BRAND AUDIO'],
    color: '#ff00aa',
  },
  {
    ico: '👥',
    name: 'TEAM LEAD',
    period: 'IGT · 3-person team',
    desc: 'Led team of 3 sound designers at IGT. Task planning, performance mentoring, EU regulated market compliance, and creative direction across multiple simultaneous titles.',
    highlights: ['IGT 2020–2024', '3-PERSON TEAM', 'EU REGULATED', 'MENTORING'],
    color: '#ff6600',
  },
  {
    ico: '🎓',
    name: 'EDUCATION',
    period: 'SAE · Faculty of Music',
    desc: 'SAE Institute Belgrade — Audio Production Diploma (Studio Recording, Mixing, Post, Interactive Media). Faculty of Music Belgrade — BA Accordion & Piano Performance.',
    highlights: ['SAE BELGRADE', 'FACULTY OF MUSIC', 'BA MUSIC PERF.', 'AUDIO DIPLOMA'],
    color: '#00ff88',
  },
  {
    ico: '⚡',
    name: 'INNOVATION',
    period: 'AI Workflow · Remote WW',
    desc: 'AI-assisted production tools for faster iteration. Logic Pro + Reaper + iZotope RX + Howler.js pipeline. Remote worldwide delivery — EU, UK, North America, AUS.',
    highlights: ['AI WORKFLOW', 'REMOTE WW', 'LOGIC + REAPER', 'IZOTOPE RX'],
    color: '#00ffcc',
  },
]

// ============================================================
// CAREER (4)
// ============================================================

export const EXP_DATA: SimpleItem[] = [
  {
    ico: '🌐',
    name: 'VANVINKL',
    period: '2024 → Present',
    desc: 'Founder & Audio Director — full-service iGaming audio production studio. End-to-end audio delivery for slot developers worldwide. Creative direction, project management, client relations, and quality assurance across every title.',
    highlights: ['FOUNDER', 'FULL-SERVICE', 'REMOTE WW', 'CLIENT DIRECT'],
    color: '#00e5ff',
  },
  {
    ico: '🎮',
    name: 'PLAYNETIC',
    period: '2024 → 2026',
    desc: 'Audio Producer & Lead Sound Designer — 10+ parallel slot titles in simultaneous production. Managed full audio pipeline: composition, SFX, integration, QA. Delivered under tight release cycles with zero audio defects at launch.',
    highlights: ['10+ TITLES', 'LEAD SOUND', 'ZERO DEFECTS', 'PARALLEL PROD.'],
    color: '#ffd700',
  },
  {
    ico: '🏛️',
    name: 'IGT',
    period: '2020 → 2024',
    desc: 'Senior Sound Designer & Audio Lead — managed team of 3 in EU-regulated market. Responsible for audio standards, compliance review, team mentoring, and creative direction across multiple concurrent slot releases for global distribution.',
    highlights: ['SENIOR LEAD', '3-PERSON TEAM', 'EU REGULATED', 'GLOBAL DIST.'],
    color: '#ff00aa',
  },
  {
    ico: '🎰',
    name: 'FREELANCE',
    period: '2018 → 2020',
    desc: 'Independent audio contractor for emerging iGaming studios. Built custom SFX libraries, composed adaptive music systems, and established the production workflow that became the foundation for VanVinkl studio methodology.',
    highlights: ['INDEPENDENT', 'CUSTOM LIBS', 'ADAPTIVE MUSIC', 'WORKFLOW DEV'],
    color: '#ff6600',
  },
  {
    ico: '🎓',
    name: 'SAE INSTITUTE',
    period: 'Audio Production Diploma',
    desc: 'SAE Institute Belgrade — Audio Production Diploma. Studio recording, mixing, mastering, post-production, and interactive media audio. Hands-on training with industry-standard DAWs, outboard gear, and spatial audio workflows.',
    highlights: ['SAE BELGRADE', 'STUDIO REC.', 'MIXING & POST', 'INTERACTIVE'],
    color: '#9944ff',
  },
  {
    ico: '🎹',
    name: 'FACULTY OF MUSIC',
    period: 'BA Performance',
    desc: 'Faculty of Music Belgrade — BA in Accordion & Piano Performance. Classical training in harmony, composition theory, orchestration, and live performance. Musical foundation that informs every game score and adaptive composition.',
    highlights: ['BA MUSIC', 'COMPOSITION', 'ORCHESTRATION', 'LIVE PERF.'],
    color: '#00ff88',
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
