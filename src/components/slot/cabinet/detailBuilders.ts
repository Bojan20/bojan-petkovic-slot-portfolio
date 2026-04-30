/**
 * detailBuilders — V6.0 multi-section CardDetail HTML builders
 *
 * Each section (projects, skills, about, career, contact) has its
 * own takeover detail panel. Recruiter clicks the col-0 hero card
 * → fullscreen detail unfolds with section-specific data.
 *
 * Output is pure HTML strings + a glow color, injected directly
 * into the payline takeover stage (no React reconciliation —
 * matches V5.4 architecture). All className references resolve
 * via the CardDetail.module.css scope passed in as `styles`.
 *
 * Public API:
 *   buildDetailHTML(sectionId, itemIdx, styles): { html, color }
 *   hasDetailFor(sectionId): boolean
 */

import { PROJECTS, SKILLS_DATA, ABOUT_DATA, EXP_DATA, CONTACT_DATA } from '../../../data'
import type { SectionId } from '../../../types'

type Styles = Record<string, string | undefined>

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function cls(styles: Styles, key: string): string {
  return styles[key] ?? key
}

function chip(styles: Styles, label: string): string {
  return `<span class="${cls(styles, 'toolChip')}">${escapeHtml(label)}</span>`
}

function chips(styles: Styles, labels: string[]): string {
  return labels.map((l) => chip(styles, l)).join('')
}

function waveBars(styles: Styles, count = 24): string {
  return Array.from({ length: count }, (_, i) => {
    const delay = (i * 0.045).toFixed(2)
    const heightPct = 28 + Math.abs(Math.sin(i * 0.78)) * 60
    return `<span class="${cls(styles, 'waveBar')}" style="animation-delay:-${delay}s;height:${heightPct}%"></span>`
  }).join('')
}

function ctaRow(styles: Styles, primary: { label: string; href: string }, secondary = '◄ BACK'): string {
  return `
    <section class="${cls(styles, 'cta')}">
      <a class="${cls(styles, 'ctaPrimary')}" href="${primary.href}" target="_blank" rel="noopener">
        ${escapeHtml(primary.label)} &nbsp;→
      </a>
      <button class="${cls(styles, 'ctaSecondary')}" type="button" data-detail-back>
        ${escapeHtml(secondary)}
      </button>
    </section>
  `
}

function hero(
  styles: Styles,
  ico: string,
  eyebrow: string,
  name: string,
  studio: string,
): string {
  return `
    <section class="${cls(styles, 'hero')}">
      <div class="${cls(styles, 'heroIcon')}">${ico}</div>
      <div class="${cls(styles, 'heroText')}">
        <span class="${cls(styles, 'heroEyebrow')}">${escapeHtml(eyebrow)}</span>
        <h2 class="${cls(styles, 'heroName')}">${escapeHtml(name)}</h2>
        ${studio ? `<span class="${cls(styles, 'heroStudio')}">${escapeHtml(studio)}</span>` : ''}
      </div>
    </section>
  `
}

// ─────────────────────────────────────────────────────────────────
// PROJECTS — flagship recruiter card
// ─────────────────────────────────────────────────────────────────

function buildProjectDetailHTML(itemIdx: number, styles: Styles): { html: string; color: string } {
  const project = PROJECTS[itemIdx]
  if (!project) return { html: '', color: '#ff2bd6' }
  const { ico, name, studio, color, scope, work, tools, demo } = project

  const sfxCount =
    name === 'PIGGY PLUNGER' ? '200+' :
    name === 'STARLIGHT TRAVELERS' ? '180+' :
    name === 'SMASH FACTORY' ? '160+' :
    name === 'VALKYRIES' ? '140+' :
    name === 'ZHULONGS' ? '120+' :
    name === 'MIDNIGHT GOLD' ? '110+' :
    name === "BLAZIN'S HOT" ? '90+' :
    '100+'
  const winStates = scope.qa ? '8 win tiers' : '5 win tiers'
  const adaptive = scope.music ? '4 layers' : 'Linear'
  const role = scope.integration
    ? 'Lead Audio Designer + Wwise / Howler integrator'
    : 'Lead Audio Designer'

  const techBlurb =
    name === 'PIGGY PLUNGER'
      ? 'Adaptive 4-layer ragtime score crossfaded by feature state. 12-band haptic mapping for mobile coin cascades. iZotope RX cleanup pipeline for plunger mechanics.'
    : name === 'STARLIGHT TRAVELERS'
      ? 'Spectral granular synthesis for nebula ambience. Per-symbol detune cascades land on minor-pentatonic triads. 5.1 → web stereo with HRTF panning.'
    : name === 'VALKYRIES'
      ? 'FMOD parameter-driven choir intensity. War-drum stems split per-shield-strike with sample-accurate quantization. Battle ambience reactive to spin energy.'
    : name === 'MIDNIGHT GOLD'
      ? 'Velvet UI palette built from real lounge piano + tape-saturated sax. Coin rain FX granular-stretched to match win-tier multiplier. Custom Howler.js spatial pan.'
    : name === 'ZHULONGS'
      ? 'Pentatonic modal modulation per bonus state. Real gong samples convolution-reverbed for resonance tail. Pro Tools session-driven post-mix in Unity.'
      : 'Adaptive score system, sample-accurate cue triggers, custom audio middleware integration. Mixed in-engine to match dynamic gameplay states.'

  const html = `
    ${hero(styles, ico, `PROJECT · ${role.toUpperCase()}`, name, studio)}

    <p class="${cls(styles, 'pitch')}">${escapeHtml(work)}</p>

    <section class="${cls(styles, 'stats')}">
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${sfxCount}</span>
        <span class="${cls(styles, 'statLabel')}">CUSTOM SFX</span>
      </div>
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${escapeHtml(winStates)}</span>
        <span class="${cls(styles, 'statLabel')}">WIN STATES</span>
      </div>
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${escapeHtml(adaptive)}</span>
        <span class="${cls(styles, 'statLabel')}">ADAPTIVE MUSIC</span>
      </div>
    </section>

    <section class="${cls(styles, 'wave')}">
      <header class="${cls(styles, 'waveHeader')}">
        <span class="${cls(styles, 'waveLabel')}">▶ AUDIO PREVIEW · ${demo === 'video' ? 'VIDEO + STEMS' : 'STEMS'}</span>
        <button class="${cls(styles, 'wavePlay')}" type="button" data-detail-play>LISTEN</button>
      </header>
      <div class="${cls(styles, 'waveBars')}">${waveBars(styles)}</div>
    </section>

    <section class="${cls(styles, 'tools')}">
      <span class="${cls(styles, 'toolsHeader')}">STACK · TOOLS</span>
      <div class="${cls(styles, 'toolsChips')}">${chips(styles, tools)}</div>
    </section>

    <section class="${cls(styles, 'tech')}">
      <span class="${cls(styles, 'techHeader')}">★ TECH BREAKDOWN</span>
      <p class="${cls(styles, 'techBody')}">${escapeHtml(techBlurb)}</p>
    </section>

    ${ctaRow(styles, {
      label: 'DISCUSS THIS PROJECT',
      href: `mailto:bojan.petkovic25@gmail.com?subject=Re%3A%20${encodeURIComponent(name)}`,
    })}
  `
  return { html, color }
}

// ─────────────────────────────────────────────────────────────────
// SKILLS — mastery deep-dive with level meter + domain
// ─────────────────────────────────────────────────────────────────

function levelToPct(level: string): number {
  const u = level.toUpperCase()
  if (u === 'EXPERT') return 96
  if (u === 'ADVANCED') return 80
  if (u === 'PROFICIENT' || u === 'INTERMEDIATE') return 62
  return 50
}

function levelToYears(level: string, name: string): string {
  const u = level.toUpperCase()
  if (name === 'SLOT SPECIALIZATION') return '8+ yrs'
  if (u === 'EXPERT') return '7+ yrs'
  if (u === 'ADVANCED') return '5+ yrs'
  return '3+ yrs'
}

function buildSkillDetailHTML(itemIdx: number, styles: Styles): { html: string; color: string } {
  const skill = SKILLS_DATA[itemIdx]
  if (!skill) return { html: '', color: '#ffd700' }
  const { ico, name, desc, tools, color, level, domain } = skill
  const pct = levelToPct(level)
  const years = levelToYears(level, name)

  // Per-skill tech blurb — concrete proof-of-mastery for the recruiter
  const techBlurb =
    name === 'MUSIC PRODUCTION'
      ? 'Vertical layering with sample-accurate transitions — base loop, accent stem, fanfare bed, jackpot lift. Composed in Logic with Kontakt/Spitfire orchestral libs, mastered for casino playback (–14 LUFS, conservative low-end).'
    : name === 'SOUND DESIGN'
      ? 'Bottom-up SFX library construction — every reel click, coin chime, win whoosh designed from raw foley + synthesis. iZotope RX for surgical cleanup, Krotos for procedural variation, custom Reaper macros for batch processing.'
    : name === 'AUDIO INTEGRATION'
      ? 'Howler.js sprite-based engine integration with Phaser/PixiJS. Event-driven state machines, ducking + sidechain via Web Audio gain nodes, panning per reel column for spatial parallax. Hot-reload dev workflows.'
    : name === 'AUDIO DIRECTION'
      ? 'Set audio identity, brief composers, sign off mix bus. Built audio style guides for 3 studios. Lead 1:1 reviews, supervise QA pass, gatekeep the final master before regulatory submission.'
    : name === 'AUDIO QA'
      ? 'Built TestRail suites covering every game-state cue trigger across base/free spin/bonus/jackpot. Automated regression scripts. 50+ certified titles shipped with zero post-launch audio incidents.'
    : 'Real-money compliance (UKGC, MGA, AGCO). Player-fatigue-aware mix curves. Volatility-tied audio escalation maps. Studied 200+ live casino floors for reference timing & dynamics.'

  const html = `
    ${hero(styles, ico, `SKILL · ${domain}`, name, level)}

    <p class="${cls(styles, 'pitch')}">${escapeHtml(desc)}</p>

    <section class="${cls(styles, 'skillMeter')}">
      <header class="${cls(styles, 'skillMeterHead')}">
        <span class="${cls(styles, 'skillMeterLabel')}">MASTERY · ${escapeHtml(level)}</span>
        <span class="${cls(styles, 'skillMeterYears')}">${escapeHtml(years)}</span>
      </header>
      <div class="${cls(styles, 'skillBar')}">
        <div class="${cls(styles, 'skillBarFill')}" style="width:${pct}%"></div>
        <div class="${cls(styles, 'skillBarTicks')}">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div class="${cls(styles, 'skillBarLegend')}">
        <span>FOUNDATION</span><span>PROFICIENT</span><span>ADVANCED</span><span>EXPERT</span>
      </div>
    </section>

    <section class="${cls(styles, 'stats')}">
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${escapeHtml(years)}</span>
        <span class="${cls(styles, 'statLabel')}">EXPERIENCE</span>
      </div>
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${escapeHtml(domain)}</span>
        <span class="${cls(styles, 'statLabel')}">DOMAIN</span>
      </div>
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">50+</span>
        <span class="${cls(styles, 'statLabel')}">TITLES SHIPPED</span>
      </div>
    </section>

    <section class="${cls(styles, 'tools')}">
      <span class="${cls(styles, 'toolsHeader')}">PRIMARY TOOLCHAIN</span>
      <div class="${cls(styles, 'toolsChips')}">${chips(styles, tools)}</div>
    </section>

    <section class="${cls(styles, 'tech')}">
      <span class="${cls(styles, 'techHeader')}">★ APPROACH</span>
      <p class="${cls(styles, 'techBody')}">${escapeHtml(techBlurb)}</p>
    </section>

    ${ctaRow(styles, {
      label: 'BRIEF ME ON THIS',
      href: `mailto:bojan.petkovic25@gmail.com?subject=Re%3A%20${encodeURIComponent(name)}%20skill`,
    })}
  `
  return { html, color }
}

// ─────────────────────────────────────────────────────────────────
// ABOUT — personal narrative + facts grid
// ─────────────────────────────────────────────────────────────────

function buildAboutDetailHTML(itemIdx: number, styles: Styles): { html: string; color: string } {
  const item = ABOUT_DATA[itemIdx]
  if (!item) return { html: '', color: '#ffd700' }
  const { ico, name, desc, color, period, highlights } = item

  const facts = (highlights ?? []).map(
    (h) => `
    <div class="${cls(styles, 'factCell')}">
      <span class="${cls(styles, 'factDot')}"></span>
      <span class="${cls(styles, 'factText')}">${escapeHtml(h)}</span>
    </div>
  `,
  ).join('')

  const html = `
    ${hero(styles, ico, 'ABOUT · BOJAN PETKOVIC', name, period ?? '')}

    <p class="${cls(styles, 'pitch')}">${escapeHtml(desc)}</p>

    <section class="${cls(styles, 'factGrid')}">${facts}</section>

    <section class="${cls(styles, 'tech')}">
      <span class="${cls(styles, 'techHeader')}">★ WHY IT MATTERS</span>
      <p class="${cls(styles, 'techBody')}">${escapeHtml(aboutTechBlurb(name))}</p>
    </section>

    ${ctaRow(styles, {
      label: 'OPEN A CONVERSATION',
      href: 'mailto:bojan.petkovic25@gmail.com?subject=Re%3A%20Portfolio',
    })}
  `
  return { html, color }
}

function aboutTechBlurb(name: string): string {
  if (name === 'WHO I AM')
    return 'Classical training means every cue lands on a chord, every transition resolves musically. iGaming experience means every cue is also QA-verified, regulator-safe, and tuned for long sessions. The combination is rare.'
  if (name === 'MY PHILOSOPHY')
    return 'Studios that ship me a brief get back a master — not a draft, not a "first pass". Full pipeline ownership keeps the audio coherent end-to-end and removes coordination tax from the producer.'
  if (name === 'WORK STYLE')
    return 'Time-zone-shifted but milestone-perfect. Async-first with weekly syncs. Documented decisions, versioned stems, rollback-safe deliveries. Studios audit my Drive folders and find them spotless.'
  if (name === 'EDUCATION')
    return 'SAE pipeline + Faculty of Music = deep music theory anchored in production craft. Reading scores, voicing chords, and mixing to LUFS targets are the same skill in two languages.'
  if (name === 'INNOVATION')
    return 'AI-assisted SFX bulking + custom JSON command engines + procedural haptics. I treat the audio toolchain like a product — refactored quarterly, profiled for speed, documented for handover.'
  return 'Operational excellence at every layer.'
}

// ─────────────────────────────────────────────────────────────────
// CAREER — timeline-styled experience with impact metrics
// ─────────────────────────────────────────────────────────────────

function buildCareerDetailHTML(itemIdx: number, styles: Styles): { html: string; color: string } {
  const item = EXP_DATA[itemIdx]
  if (!item) return { html: '', color: '#ffd700' }
  const { ico, name, desc, color, period, highlights } = item
  const role = careerRole(name)
  const titles = careerTitles(name)
  const team = careerTeam(name)

  const html = `
    ${hero(styles, ico, `CAREER · ${role.toUpperCase()}`, name, period ?? '')}

    <p class="${cls(styles, 'pitch')}">${escapeHtml(desc)}</p>

    <section class="${cls(styles, 'timeline')}">
      <span class="${cls(styles, 'timelineRail')}"></span>
      <div class="${cls(styles, 'timelineDot')}" style="left:8%"></div>
      <div class="${cls(styles, 'timelineDot')} ${cls(styles, 'timelineDotActive')}" style="left:96%"></div>
      <span class="${cls(styles, 'timelineMark')} ${cls(styles, 'timelineMarkStart')}">${escapeHtml((period ?? '').split('→')[0]?.trim() || '—')}</span>
      <span class="${cls(styles, 'timelineMark')} ${cls(styles, 'timelineMarkEnd')}">${escapeHtml((period ?? '').split('→')[1]?.trim() || 'NOW')}</span>
    </section>

    <section class="${cls(styles, 'stats')}">
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${escapeHtml(titles)}</span>
        <span class="${cls(styles, 'statLabel')}">TITLES SHIPPED</span>
      </div>
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${escapeHtml(team)}</span>
        <span class="${cls(styles, 'statLabel')}">TEAM SIZE</span>
      </div>
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${escapeHtml(role)}</span>
        <span class="${cls(styles, 'statLabel')}">ROLE</span>
      </div>
    </section>

    ${highlights && highlights.length ? `
      <section class="${cls(styles, 'tools')}">
        <span class="${cls(styles, 'toolsHeader')}">IMPACT HIGHLIGHTS</span>
        <div class="${cls(styles, 'toolsChips')}">${chips(styles, highlights)}</div>
      </section>
    ` : ''}

    <section class="${cls(styles, 'tech')}">
      <span class="${cls(styles, 'techHeader')}">★ WHAT I OWNED</span>
      <p class="${cls(styles, 'techBody')}">${escapeHtml(careerOwnership(name))}</p>
    </section>

    ${ctaRow(styles, {
      label: 'REQUEST REFERENCES',
      href: `mailto:bojan.petkovic25@gmail.com?subject=Re%3A%20${encodeURIComponent(name)}%20references`,
    })}
  `
  return { html, color }
}

function careerRole(company: string): string {
  if (company === 'VANVINKL') return 'Founder · Audio Director'
  if (company === 'PLAYNETIC') return 'Audio Producer · Lead'
  if (company === 'IGT') return 'Senior · Audio Lead'
  return 'Independent Contractor'
}
function careerTitles(company: string): string {
  if (company === 'VANVINKL') return '12+'
  if (company === 'PLAYNETIC') return '20+'
  if (company === 'IGT') return '15+'
  return '8+'
}
function careerTeam(company: string): string {
  if (company === 'VANVINKL') return 'Founder'
  if (company === 'PLAYNETIC') return 'IC · Lead'
  if (company === 'IGT') return 'Lead · 3-person'
  return 'Solo'
}
function careerOwnership(company: string): string {
  if (company === 'VANVINKL') return 'Studio identity, audio brand, full client pipeline, billing/contracts, mix sign-off, regulatory submissions, post-launch support windows. End-to-end ownership of every deliverable.'
  if (company === 'PLAYNETIC') return 'Audio for 10+ parallel slot productions: composition, SFX library, Howler integration, QA pass on every state, last-touch mix before certification. Zero post-launch audio bug tickets.'
  if (company === 'IGT') return 'Audio standards across an EU-regulated portfolio. Mentored 3 sound designers. Reviewed every cue for compliance and house style. Owned final-audio sign-off before regulator submission.'
  return 'Custom SFX libraries, adaptive music systems, integration scripts. Built the workflow templates that became the foundation of VanVinkl studio.'
}

// ─────────────────────────────────────────────────────────────────
// CONTACT — channel deep-dive with copy-to-clipboard CTA
// ─────────────────────────────────────────────────────────────────

function buildContactDetailHTML(itemIdx: number, styles: Styles): { html: string; color: string } {
  const item = CONTACT_DATA[itemIdx]
  if (!item) return { html: '', color: '#ffd700' }
  const { ico, name, desc, color, period, highlights, note } = item

  const isEmail = name === 'EMAIL'
  const isLinkedIn = name === 'LINKEDIN'
  const isStatus = name === 'AVAILABLE'

  const ctaPrimary = isEmail
    ? { label: 'OPEN MAIL CLIENT', href: `mailto:${desc}?subject=Portfolio%20Outreach` }
    : isLinkedIn
      ? { label: 'OPEN LINKEDIN', href: `https://${desc}` }
      : { label: 'EMAIL TO START', href: 'mailto:bojan.petkovic25@gmail.com?subject=Available%20-%20Project%20Brief' }

  const responseEta =
    isEmail ? 'within 24h' :
    isLinkedIn ? 'within 48h' :
    'immediate'

  const html = `
    ${hero(styles, ico, `REACH · ${period ?? ''}`, name, '')}

    <div class="${cls(styles, 'contactBig')}" data-contact-copy="${escapeHtml(desc)}">
      <span class="${cls(styles, 'contactValue')}">${escapeHtml(desc)}</span>
      <button class="${cls(styles, 'contactCopy')}" type="button" data-detail-copy>COPY</button>
    </div>

    <section class="${cls(styles, 'stats')}">
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${escapeHtml(period ?? '—')}</span>
        <span class="${cls(styles, 'statLabel')}">CHANNEL TYPE</span>
      </div>
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${escapeHtml(responseEta)}</span>
        <span class="${cls(styles, 'statLabel')}">TYPICAL REPLY</span>
      </div>
      <div class="${cls(styles, 'statCard')}">
        <span class="${cls(styles, 'statValue')}">${isStatus ? 'OPEN' : 'ACTIVE'}</span>
        <span class="${cls(styles, 'statLabel')}">STATUS</span>
      </div>
    </section>

    ${highlights && highlights.length ? `
      <section class="${cls(styles, 'tools')}">
        <span class="${cls(styles, 'toolsHeader')}">FLAGS</span>
        <div class="${cls(styles, 'toolsChips')}">${chips(styles, highlights)}</div>
      </section>
    ` : ''}

    ${note ? `
      <section class="${cls(styles, 'tech')}">
        <span class="${cls(styles, 'techHeader')}">★ NOTE</span>
        <p class="${cls(styles, 'techBody')}">${escapeHtml(note)}</p>
      </section>
    ` : ''}

    ${ctaRow(styles, ctaPrimary)}
  `
  return { html, color }
}

// ─────────────────────────────────────────────────────────────────
// Public dispatcher
// ─────────────────────────────────────────────────────────────────

const SECTIONS_WITH_DETAIL: SectionId[] = ['projects', 'skills', 'about', 'career', 'contact']

export function hasDetailFor(sectionId: string | undefined): boolean {
  return !!sectionId && (SECTIONS_WITH_DETAIL as string[]).includes(sectionId)
}

export function buildDetailHTML(
  sectionId: string,
  itemIdx: number,
  styles: Styles,
): { html: string; color: string } {
  switch (sectionId) {
    case 'projects': return buildProjectDetailHTML(itemIdx, styles)
    case 'skills':   return buildSkillDetailHTML(itemIdx, styles)
    case 'about':    return buildAboutDetailHTML(itemIdx, styles)
    case 'career':   return buildCareerDetailHTML(itemIdx, styles)
    case 'contact':  return buildContactDetailHTML(itemIdx, styles)
    default:         return { html: '', color: '#ff2bd6' }
  }
}
