/**
 * Portfolio Data — All reel content
 * Source: vanvinkl-concept-a7.html mockup
 */

import type { ProjectItem, SkillItem, SimpleItem, SectionDef } from '../types'

// ============================================================
// SECTIONS
// ============================================================

export const SECTIONS: SectionDef[] = [
  { id: 'projects', label: 'PROJECTS', icon: '◈', headers: ['GAME', 'SCOPE', 'THE WORK', 'DEMO'],   headerIcons: ['⬡', '◎', '◆', '▶'], numCols: 4 },
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
    ico: '🎵',
    name: 'MUSIC PRODUCTION',
    desc: 'Adaptive layered compositions — base game loops, free spin escalation, jackpot fanfares. Seamless state transitions timed to volatility and player engagement.',
    tools: ['Logic Pro', 'Reaper', 'Kontakt', 'Spitfire'],
    color: '#ffd700',
  },
  {
    ico: '🔊',
    name: 'SOUND DESIGN',
    desc: '200+ custom SFX per title — reel mechanics, coin physics, win escalation, UI feedback, ambience layers. Every asset purpose-built from scratch.',
    tools: ['iZotope RX', 'Logic Pro', 'Reaper', 'Krotos'],
    color: '#00e5ff',
  },
  {
    ico: '⚙️',
    name: 'AUDIO INTEGRATION',
    desc: 'Event-driven playback systems wired directly into game engines. Trigger maps, state machines, volume ducking, spatial positioning.',
    tools: ['Howler.js', 'Phaser 3', 'Unity', 'PixiJS'],
    color: '#00ff88',
  },
  {
    ico: '🎛️',
    name: 'AUDIO DIRECTION',
    desc: 'Creative leadership across full titles — defining sonic identity, setting quality standards, supervising mix, final sign-off on every game state.',
    tools: ['Confluence', 'Figma', 'JIRA', 'Slack'],
    color: '#ff00aa',
  },
  {
    ico: '🧪',
    name: 'AUDIO QA',
    desc: 'Systematic trigger verification across every game state — base, free spins, bonus, jackpot. Zero audio defects at launch across 50+ certified titles.',
    tools: ['TestRail', 'JIRA', 'Custom Scripts'],
    color: '#9944ff',
  },
  {
    ico: '🎰',
    name: 'SLOT SPECIALIZATION',
    desc: 'Deep domain expertise in real-money slot audio. Regulatory compliance (EU, UK, AUS), player psychology, session fatigue management, volatility-aware audio design.',
    tools: ['FMOD', 'Wwise', 'Howler.js', 'Tone.js'],
    color: '#ff6600',
  },
]

// ============================================================
// ABOUT (5 personal aspects — WHO is Bojan)
// Col 0: PROFILE (simple — icon + title + subtitle)
// Col 1: STORY   (detail — personal paragraph)
// Col 2: FACTS   (tools — personal stat badges)
// ============================================================

export const ABOUT_DATA: SimpleItem[] = [
  {
    ico: '👤',
    name: 'WHO I AM',
    period: 'Belgrade, Serbia',
    desc: 'Senior audio professional from Belgrade, Serbia. 8+ years specializing in iGaming and slot audio production. Classically trained musician turned game audio expert — every score and sound effect carries musical intent and technical precision.',
    highlights: ['BELGRADE, RS', '8+ YEARS', 'IGAMING SPECIALIST', 'MUSICIAN'],
    color: '#ffd700',
  },
  {
    ico: '🎯',
    name: 'MY PHILOSOPHY',
    period: 'Zero-Defect · Full Pipeline',
    desc: 'Full pipeline ownership from concept to certified release. Every asset purpose-built, every trigger QA-verified, every mix balanced for long casino sessions. Audio is not decoration — it drives player engagement and brand identity.',
    highlights: ['FULL OWNERSHIP', 'ZERO DEFECTS', 'PURPOSE-BUILT', 'BRAND IDENTITY'],
    color: '#00e5ff',
  },
  {
    ico: '🌍',
    name: 'WORK STYLE',
    period: 'Remote Worldwide',
    desc: 'Remote delivery to studios across EU, UK, North America, and Australia. Comfortable managing 10+ parallel titles under tight release cycles. Clear communication, structured milestones, predictable delivery — every single time.',
    highlights: ['REMOTE WW', '10+ PARALLEL', 'EU · UK · US · AUS', 'ON-TIME ALWAYS'],
    color: '#9944ff',
  },
  {
    ico: '🎓',
    name: 'EDUCATION',
    period: 'SAE · Faculty of Music',
    desc: 'SAE Institute Belgrade — Audio Production Diploma (studio recording, mixing, post-production, interactive media). Faculty of Music Belgrade — BA in Accordion & Piano Performance. Classical harmony, orchestration, and live performance training.',
    highlights: ['SAE DIPLOMA', 'BA MUSIC PERF.', 'AUDIO PRODUCTION', 'CLASSICAL'],
    color: '#ff00aa',
  },
  {
    ico: '⚡',
    name: 'INNOVATION',
    period: 'AI · Modern Workflow',
    desc: 'AI-assisted production for faster iteration without quality loss. Custom toolchains built around Logic Pro, Reaper, iZotope RX, and Howler.js. Always exploring new tech to push slot audio quality forward.',
    highlights: ['AI WORKFLOW', 'CUSTOM TOOLS', 'FAST ITERATION', 'TECH-FORWARD'],
    color: '#00ffcc',
  },
]

// ============================================================
// CAREER (4 — work experience only, no education)
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
