/**
 * MoodboardV3 — Static visual mood board for SLOT V3 ("Vanvinkl Engine").
 *
 * Mounted ONLY when URL contains ?moodboard=v3. Bypasses the entire
 * boot → splash → slot pipeline and renders a single full-viewport
 * canvas previewing the V3 redesign before any of it lands in the
 * live machine. Used to align with Boki on style direction without
 * burning hours on a rollout the visual language might miss.
 *
 * Sections:
 *   1. CABINET MOCKUP   — full-frame V3 slot (marquee + HUD + reel
 *                          zone + control deck + LED side-rails)
 *   2. CELL GALLERY     — 6 holographic card variants (game / scope /
 *                          tools / demo / detail / jackpot)
 *   3. WIN STATES       — 4 win-tier visual snapshots
 *   4. PALETTE          — color tokens + typography reference
 *
 * Pure presentation, no engine wiring, no state. CSS modules carry
 * 100% of the visual language so each piece is copy-paste-ready into
 * production components when V3 rollout starts.
 */

import { useEffect } from 'react'
import styles from './MoodboardV3.module.css'

export function MoodboardV3() {
  // Lock body scroll while moodboard is active so it feels like a
  // standalone canvas, not a section of the app.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.setAttribute('data-moodboard', '')
    return () => {
      document.body.style.overflow = prev
      document.body.removeAttribute('data-moodboard')
    }
  }, [])

  return (
    <div className={styles.root}>
      {/* World — animated parallax background (3 layers) */}
      <div className={styles.worldFar} aria-hidden="true" />
      <div className={styles.worldMid} aria-hidden="true" />
      <div className={styles.worldNear} aria-hidden="true" />

      {/* Header ribbon */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerBadge}>V3</span>
          <span className={styles.headerTitle}>VANVINKL ENGINE</span>
          <span className={styles.headerSub}>· moodboard ·</span>
        </div>
        <div className={styles.headerRight}>
          <a href="?" className={styles.headerBack}>← BACK TO LIVE</a>
        </div>
      </header>

      <main className={styles.canvas}>

        {/* ════════════════════════════════════════════════════════════
            SECTION 1 — CABINET MOCKUP
            ════════════════════════════════════════════════════════════ */}
        <section className={styles.section}>
          <SectionLabel idx="01" title="CABINET" sub="full-frame v3 slot" />

          <div className={styles.cabinet}>
            {/* Side rails — LED chase lights */}
            <div className={`${styles.sideRail} ${styles.sideRailLeft}`}>
              <div className={styles.sideRailChase} />
            </div>
            <div className={`${styles.sideRail} ${styles.sideRailRight}`}>
              <div className={styles.sideRailChase} />
            </div>

            {/* Top marquee — scrolling brand ticker */}
            <div className={styles.marquee}>
              <div className={styles.marqueeTrack}>
                <span>◆ VANVINKL · BOJAN PETKOVIĆ · AUDIO DIRECTOR · 8 YEARS · 50+ TITLES ·</span>
                <span>◆ AVAILABLE FOR HIRE · REACH OUT · WWISE · FMOD · UNREAL · UNITY ·</span>
                <span>◆ VANVINKL · BOJAN PETKOVIĆ · AUDIO DIRECTOR · 8 YEARS · 50+ TITLES ·</span>
              </div>
            </div>

            {/* Info HUD strip */}
            <div className={styles.infoHud}>
              <div className={styles.hudItem}>
                <span className={styles.hudLabel}>SECTION</span>
                <span className={styles.hudValue}>WORK</span>
              </div>
              <div className={styles.hudSep} />
              <div className={styles.hudItem}>
                <span className={styles.hudLabel}>VISITED</span>
                <span className={styles.hudValue}>3<small>/24</small></span>
              </div>
              <div className={styles.hudSep} />
              <div className={styles.hudItem}>
                <span className={styles.hudLabel}>STREAK</span>
                <span className={styles.hudValue} data-glow="cyan">×3</span>
              </div>
              <div className={styles.hudSep} />
              <div className={styles.hudItem}>
                <span className={styles.hudLabel}>JACKPOT</span>
                <span className={styles.hudValue} data-glow="gold">$1,337</span>
              </div>
              <div className={styles.hudSep} />
              <div className={styles.hudItem}>
                <span className={styles.hudLabel}>PERSONA</span>
                <span className={styles.hudValue}>AUDIO_DESIGNER</span>
              </div>
            </div>

            {/* Reel zone — 3D cylinder illusion */}
            <div className={styles.reelZone}>
              <div className={styles.reelInner}>
                {[0, 1, 2, 3, 4].map((col) => (
                  <div key={col} className={styles.reelCol} data-col={col}>
                    {/* Top edge cell — receding into cylinder */}
                    <div className={`${styles.reelCell} ${styles.reelCellEdge}`}>
                      <MiniCellLabel col={col} variant="top" />
                    </div>
                    {/* Center cell — focused */}
                    <div className={`${styles.reelCell} ${styles.reelCellCenter}`}>
                      <MiniCellLabel col={col} variant="center" />
                      <div className={styles.reelCellRim} />
                    </div>
                    {/* Bottom edge cell */}
                    <div className={`${styles.reelCell} ${styles.reelCellEdge}`}>
                      <MiniCellLabel col={col} variant="bottom" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Payline — center horizontal beam (idle, unlit) */}
              <div className={styles.paylineRail} />
              {/* Reel zone gradient masks (fade top/bottom into cylinder darkness) */}
              <div className={styles.reelMaskTop} />
              <div className={styles.reelMaskBot} />
              {/* Floating particle dust */}
              <div className={styles.particleField}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <span key={i} className={styles.particle} style={{ ['--i' as string]: i } as React.CSSProperties} />
                ))}
              </div>
            </div>

            {/* HUD strip — win meter */}
            <div className={styles.winStrip}>
              <div className={styles.winMeter}>
                <span className={styles.winLabel}>LAST WIN</span>
                <span className={styles.winValue}>$200</span>
                <span className={styles.winChip} data-tier="medium">MEDIUM</span>
              </div>
              <div className={styles.winSpark} />
              <div className={styles.winMeter}>
                <span className={styles.winLabel}>COMBO</span>
                <span className={styles.winValue}>×3</span>
                <span className={styles.winChip} data-tier="streak">STREAK</span>
              </div>
            </div>

            {/* Control deck */}
            <div className={styles.controlDeck}>
              <button className={styles.deckBtn} type="button">
                <span className={styles.deckBtnLbl}>AUTO</span>
                <span className={styles.deckBtnSub}>5</span>
              </button>
              <button className={styles.deckBtn} type="button">
                <span className={styles.deckBtnLbl}>BET</span>
                <span className={styles.deckBtnSub}>−</span>
              </button>

              <div className={styles.spinSlot}>
                <button className={styles.spinBtn} type="button" aria-label="Spin">
                  <div className={styles.spinOrbit} />
                  <div className={styles.spinOrbit2} />
                  <span className={styles.spinIcon}>◉</span>
                  <span className={styles.spinLabel}>SPIN</span>
                </button>
              </div>

              <button className={styles.deckBtn} type="button">
                <span className={styles.deckBtnLbl}>BET</span>
                <span className={styles.deckBtnSub}>+</span>
              </button>
              <button className={`${styles.deckBtn} ${styles.deckBtnAccent}`} type="button">
                <span className={styles.deckBtnLbl}>MAX</span>
                <span className={styles.deckBtnSub}>×10</span>
              </button>
            </div>

            {/* Sub-frame LED ticker */}
            <div className={styles.subFrame}>
              <span className={styles.subFrameDot} />
              <span>AVAILABLE FOR HIRE · CONTACT BOJAN.PETKOVIC25@GMAIL.COM · BELGRADE · REMOTE / RELO</span>
              <span className={styles.subFrameDot} />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 2 — CELL GALLERY
            ════════════════════════════════════════════════════════════ */}
        <section className={styles.section}>
          <SectionLabel idx="02" title="CELLS" sub="holographic cards · 6 variants" />

          <div className={styles.cellGallery}>
            {/* Game card — hero project */}
            <CellCard
              tone="game"
              palette="#ff2bd6"
              top="GAME"
              eyebrow="WORK · JACKPOT"
              title="PIGGY PLUNGER"
              sub="Pragmatic Play · 2024"
              chips={['SFX', 'MUSIC', 'WWISE', 'UE5']}
              cta="EXPLORE"
              hasMedia
            />
            {/* Scope card — capability */}
            <CellCard
              tone="scope"
              palette="#22e8ff"
              top="SCOPE"
              eyebrow="DELIVERABLES"
              title="180+ SFX"
              sub="across 6 wins · 24 reels"
              chips={['CASINO', 'HALL', 'COIN', 'WIN']}
              cta="VIEW LIST"
            />
            {/* Tools card */}
            <CellCard
              tone="tools"
              palette="#b14cff"
              top="TOOLS"
              eyebrow="STACK"
              title="WWISE + REAPER"
              sub="primary chain · 2024"
              chips={['WAAPI', 'LUA', 'JS', 'PY']}
              cta="STACK MAP"
            />
            {/* Demo card — playable preview */}
            <CellCard
              tone="demo"
              palette="#23ff95"
              top="DEMO"
              eyebrow="LIVE PREVIEW"
              title="REEL TICK"
              sub="hover to scrub · 0.6s"
              chips={['LOOP', '44.1', 'MONO']}
              cta="▶ PLAY"
              hasWaveform
            />
            {/* Detail card — stat block */}
            <CellCard
              tone="detail"
              palette="#ffd166"
              top="DETAIL"
              eyebrow="OUTCOME"
              title="0 DEFECTS"
              sub="across 50+ titles"
              chips={['QA', 'CERT', 'SHIPPED']}
              cta="CASE STUDY"
              isStat
            />
            {/* Jackpot card — top tier */}
            <CellCard
              tone="jackpot"
              palette="#ffe066"
              top="JACKPOT"
              eyebrow="TOP PROJECT"
              title="STARLIGHT TRAVELERS"
              sub="Hacksaw · 2025"
              chips={['SFX', 'MUSIC', 'IMPLEMENT', 'MIX']}
              cta="ENTER ↗"
              hasMedia
              isJackpot
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 3 — WIN STATES
            ════════════════════════════════════════════════════════════ */}
        <section className={styles.section}>
          <SectionLabel idx="03" title="WIN STATES" sub="4 cinematic tiers" />

          <div className={styles.winGrid}>
            <WinPanel tier="small"   label="SMALL"   amount="$50"     fx="centerline glow + chime" />
            <WinPanel tier="medium"  label="MEDIUM"  amount="$200"    fx="payline trail + LED reverse" />
            <WinPanel tier="big"     label="BIG"     amount="$500"    fx="darken + scanline kick + particles" />
            <WinPanel tier="jackpot" label="JACKPOT" amount="$1,337"  fx="vertigo + shower + chromatic split" />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 4 — PALETTE & TYPE
            ════════════════════════════════════════════════════════════ */}
        <section className={styles.section}>
          <SectionLabel idx="04" title="PALETTE" sub="color tokens · typography" />

          <div className={styles.paletteGrid}>
            <Swatch hex="#ff2bd6" name="MAGENTA" use="game / hero" />
            <Swatch hex="#22e8ff" name="CYAN"    use="scope / data" />
            <Swatch hex="#b14cff" name="VIOLET"  use="tools / framework" />
            <Swatch hex="#23ff95" name="MINT"    use="demo / live" />
            <Swatch hex="#ffd166" name="GOLD"    use="detail / outcome" />
            <Swatch hex="#ffe066" name="JACKPOT" use="top tier" glow />
            <Swatch hex="#0a0e1a" name="VOID"    use="bg / shadow" dark />
            <Swatch hex="#161a2e" name="STEEL"   use="card base" dark />
          </div>

          <div className={styles.typeDeck}>
            <div className={styles.typeRow}>
              <span className={styles.typeKey}>DISPLAY</span>
              <span className={styles.typeDisplay}>VANVINKL ENGINE V3</span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeKey}>HEADLINE</span>
              <span className={styles.typeHeadline}>STARLIGHT TRAVELERS</span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeKey}>UI</span>
              <span className={styles.typeUi}>SECTION · WORK · 3/24 VISITED</span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeKey}>BODY</span>
              <span className={styles.typeBody}>180+ SFX delivered across 6 wins, 24 reels, 8 ambient beds. Wwise integrated, mixed, certified, shipped.</span>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <footer className={styles.footer}>
          <span>This is a static moodboard — no live state, no audio. Tells you the V3 *style*; rollout will animate everything.</span>
        </footer>
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function SectionLabel(props: { idx: string; title: string; sub: string }) {
  return (
    <div className={styles.sectionLabel}>
      <span className={styles.sectionIdx}>{props.idx}</span>
      <span className={styles.sectionTitle}>{props.title}</span>
      <span className={styles.sectionSub}>· {props.sub} ·</span>
      <span className={styles.sectionLine} />
    </div>
  )
}

function MiniCellLabel(props: { col: number; variant: 'top' | 'center' | 'bottom' }) {
  const labels = [
    { top: 'piggy plunger', center: 'STARLIGHT', bottom: 'zhulongs' },
    { top: 'ambient', center: 'SFX × 180', bottom: 'mix · 7.1' },
    { top: 'wwise', center: 'REAPER', bottom: 'pro tools' },
    { top: 'loop', center: 'LIVE DEMO', bottom: 'scrub' },
    { top: 'shipped', center: '0 DEFECTS', bottom: 'cert' },
  ]
  const set = labels[props.col]!
  return <span className={styles[`miniLabel_${props.variant}`]}>{set[props.variant]}</span>
}

interface CellCardProps {
  tone: 'game' | 'scope' | 'tools' | 'demo' | 'detail' | 'jackpot'
  palette: string
  top: string
  eyebrow: string
  title: string
  sub: string
  chips: string[]
  cta: string
  hasMedia?: boolean
  hasWaveform?: boolean
  isStat?: boolean
  isJackpot?: boolean
}

function CellCard(props: CellCardProps) {
  return (
    <div
      className={`${styles.card} ${styles[`card_${props.tone}`]} ${props.isJackpot ? styles.cardJackpot : ''}`}
      style={{ ['--card-glow' as string]: props.palette } as React.CSSProperties}
    >
      {/* Holographic outer rim */}
      <div className={styles.cardRim} aria-hidden="true" />
      {/* Inner glass + sheen */}
      <div className={styles.cardSheen} aria-hidden="true" />

      {/* Top tag */}
      <div className={styles.cardTop}>
        <span className={styles.cardTopTag}>{props.top}</span>
        {props.isJackpot && <span className={styles.cardTopJackpot}>★ JACKPOT</span>}
      </div>

      {/* Media area */}
      {props.hasMedia && (
        <div className={styles.cardMedia}>
          <div className={styles.cardMediaCore} />
          <div className={styles.cardMediaGrid} />
        </div>
      )}
      {props.hasWaveform && (
        <div className={styles.cardWave}>
          {Array.from({ length: 36 }).map((_, i) => (
            <span key={i} className={styles.cardWaveBar} style={{ ['--i' as string]: i } as React.CSSProperties} />
          ))}
        </div>
      )}
      {props.isStat && (
        <div className={styles.cardStat}>
          <span className={styles.cardStatBig}>0</span>
          <span className={styles.cardStatLbl}>defects shipped</span>
        </div>
      )}

      {/* Body */}
      <div className={styles.cardBody}>
        <span className={styles.cardEyebrow}>{props.eyebrow}</span>
        <h3 className={styles.cardTitle}>{props.title}</h3>
        <span className={styles.cardSub}>{props.sub}</span>

        <div className={styles.cardChips}>
          {props.chips.map((c) => (
            <span key={c} className={styles.cardChip}>{c}</span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className={styles.cardCta}>
        <span className={styles.cardCtaLbl}>{props.cta}</span>
        <span className={styles.cardCtaArrow}>→</span>
      </div>
    </div>
  )
}

function WinPanel(props: { tier: string; label: string; amount: string; fx: string }) {
  return (
    <div className={`${styles.winPanel} ${styles[`winPanel_${props.tier}`]}`}>
      <div className={styles.winPanelInner}>
        <span className={styles.winPanelTier}>{props.label}</span>
        <span className={styles.winPanelAmount}>{props.amount}</span>
        <span className={styles.winPanelFx}>{props.fx}</span>
      </div>
      <div className={styles.winPanelGlow} />
    </div>
  )
}

function Swatch(props: { hex: string; name: string; use: string; glow?: boolean; dark?: boolean }) {
  return (
    <div className={`${styles.swatch} ${props.dark ? styles.swatchDark : ''}`}>
      <div
        className={styles.swatchChip}
        style={{
          background: props.hex,
          boxShadow: props.glow ? `0 0 32px ${props.hex}88, 0 0 72px ${props.hex}44` : undefined,
        }}
      />
      <div className={styles.swatchMeta}>
        <span className={styles.swatchName}>{props.name}</span>
        <span className={styles.swatchHex}>{props.hex}</span>
        <span className={styles.swatchUse}>{props.use}</span>
      </div>
    </div>
  )
}

export default MoodboardV3
