import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  bus,
  playReelAccent,
  playPaylineTravel,
  playJackpotBloom,
  playSynthById,
  vibrate,
  recordVisit,
  pickNextItem,
  getCurrentPersona,
  isCellVisited,
} from '../../engine'
import { useSlotStore, useAudioStore } from '../../store'
import { PROJECTS, SKILLS_DATA, ABOUT_DATA, EXP_DATA, CONTACT_DATA, SECTIONS } from '../../data'
import type { CellData } from '../../types'
import { TabBar } from './TabBar'
import { Frame } from './Frame'
import { ReelColumn } from './ReelColumn'
import { getStrategy, STRATEGIES } from './sections'
import cardDetailStyles from './cabinet/CardDetail.module.css'
import { buildDetailHTML, hasDetailFor } from './cabinet/detailBuilders'
import {
  CabinetMarquee,
  CabinetHUD,
  CabinetWinStrip,
  CabinetSubFrame,
  CabinetControlDeck,
  CabinetWinFx,
  CabinetWorld,
  CabinetAnticipation,
  CabinetCamera,
  CabinetLensFlare,
  // CabinetVoxelFloor removed from active render (V9.4): the Tron
  // grid floor was the "pod ispod slot mašine" the user asked to drop.
  // Module still exported by ./cabinet for future re-enable.
  // CabinetConnectionLines also disabled (visual noise on hover).
  CabinetAura,
} from './cabinet'
import styles from './SlotMachine.module.css'

/**
 * Section-data lookup for code paths outside `getColData` (payline
 * takeover, hover preview, etc.) that need the raw item arrays.
 * Strategies own assembly; this helper owns raw-data access.
 */
function getDataForSection(sectionIdx: number) {
  switch (sectionIdx) {
    case 0: return PROJECTS
    case 1: return SKILLS_DATA
    case 2: return ABOUT_DATA
    case 3: return EXP_DATA
    case 4: return CONTACT_DATA
    default: return PROJECTS
  }
}

/**
 * Row excitement — delegates to the section strategy (P0.7 refactor).
 * Strategies without an `rowExcitement` scorer return 0 (no win
 * condition exists for that section).
 */
function rowExcitement(sectionIdx: number, itemIdx: number): number {
  const secId = SECTIONS[sectionIdx]?.id
  const strat = getStrategy(secId)
  return strat?.rowExcitement?.(itemIdx) ?? 0
}

/** Map an excitement score to a slot:win type bucket. */
function excitementToWinType(e: number): 'small' | 'medium' | 'big' | 'jackpot' | null {
  if (e >= 0.85) return 'jackpot'
  if (e >= 0.60) return 'big'
  if (e >= 0.40) return 'medium'
  if (e >= 0.20) return 'small'
  return null
}

/**
 * Near-miss gate (P0.4). When the spun-to row would be a jackpot
 * (excitement ≥ 0.85), 25% of the time we steer to an adjacent
 * non-jackpot row instead. The recruiter sees a "rich" project but
 * not the perfect 5/5 — the standard psychological multiplier from
 * 50 years of slot research.
 *
 * This is disclosed in the DevOverlay and disabled when
 * `audioStore.nearMissEnabled` is false. Pure function — caller
 * passes the toggle state.
 *
 * @param targetIdx the row the user spun to
 * @param sectionIdx current section
 * @param enabled near-miss bias toggle
 * @returns the adjusted index (or original if no near-miss applies)
 */
const NEAR_MISS_PROBABILITY = 0.25
function nearMissAdjust(targetIdx: number, sectionIdx: number, enabled: boolean): number {
  if (!enabled) return targetIdx
  const e = rowExcitement(sectionIdx, targetIdx)
  if (e < 0.85) return targetIdx               // not a jackpot row
  if (Math.random() > NEAR_MISS_PROBABILITY) return targetIdx  // 75% jackpot proceeds
  // Find the nearest adjacent index that's NOT also a jackpot row.
  const secId = SECTIONS[sectionIdx]?.id
  const len = secId ? STRATEGIES[secId].itemCount : 0
  if (len === 0) return targetIdx
  for (const offset of [-1, 1, -2, 2]) {
    const candidate = ((targetIdx + offset) % len + len) % len
    if (rowExcitement(sectionIdx, candidate) < 0.85) return candidate
  }
  return targetIdx
}

/**
 * Build the visible reel grid — delegates to the per-section strategy.
 * Replaces the old polymorphic if/else over secId. Adding a section
 * is now `register strategy in sections/index.ts`, no SlotMachine edit.
 */
function getColData(sectionIdx: number, centerIdx: number): CellData[][] {
  const secId = SECTIONS[sectionIdx]?.id
  const strat = getStrategy(secId) ?? STRATEGIES.projects
  return strat.assemble(centerIdx)
}

/**
 * V5.2 — Build cinematic recruiter card detail HTML for the given
 * project index. Returns a complete innerHTML string with all V5.2
 * sections. Pure HTML so it can be DOM-injected directly into the
 * payline takeover stage without React reconciliation.
 *
 * Sections (top → bottom):
 *   • HERO   — large icon + name (gradient) + studio
 *   • PITCH  — single-line work summary, palette-bordered
 *   • STATS  — 3 numeric stat cards (auto-derived from project)
 *   • WAVE   — animated waveform placeholder + listen button
 *   • TOOLS  — chip grid (Wwise, Reaper, etc.)
 *   • TECH   — tech-breakdown blockquote
 *   • CTA    — primary "Open Demo" + secondary "Read Case"
 */
// V6.0 — buildProjectDetailHTML + escapeHtml moved to ./cabinet/detailBuilders.ts.
// All sections (projects, skills, about, career, contact) now have takeover
// detail panels via the buildDetailHTML(sectionId, itemIdx, styles) dispatcher.

interface SlotMachineProps {
  /** Block all interaction during intro transition */
  locked?: boolean
  /** True while App is in 'entering' phase — triggers genesis timeline */
  entering?: boolean
}

export function SlotMachine({ locked = false, entering = false }: SlotMachineProps) {
  const {
    currentSectionIdx,
    currentItemIdx,
    isSpinning,
    spinPhase,
    credits,
    jackpot,
    setSection,
    setItemIdx,
    setSpinning,
    setSpinPhase,
    tickJackpot,
  } = useSlotStore()

  // Measured cell height + zone height (needed for correct stripTop)
  const [cellHeight, setCellHeight] = useState(0)
  const [_zoneHeight, setZoneHeight] = useState(0)
  const reelsInnerRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const reelsZoneRef = useRef<HTMLDivElement>(null)
  const stripRefs = useRef<(HTMLDivElement | null)[]>([])
  const colRefs = useRef<(HTMLDivElement | null)[]>([])
  const machineRef = useRef<HTMLDivElement>(null)
  const tabBarWrapRef = useRef<HTMLDivElement>(null)
  const reelHeadersRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const takeoverTlRef = useRef<gsap.core.Timeline | null>(null)
  const takeoverCleanupRef = useRef<(() => void) | null>(null)
  const genesisRanRef = useRef(false)

  // Current column data
  const [colData, setColData] = useState<CellData[][]>(() =>
    getColData(0, 0)
  )

  // Active GSAP spin tweens (one per column)
  const spinTweensRef = useRef<(gsap.core.Tween | null)[]>([])

  // Swipe indicators
  const [showSecL, setShowSecL] = useState(false)
  const [showSecR, setShowSecR] = useState(false)

  // Measure cell height — target square cells (width = height)
  // Calculate column width mathematically (no DOM chicken-and-egg).
  // P4.4 — on viewports ≤ 640px we collapse to single-column focus
  // (hero tile only); CSS hides cols 1..4 and we recompute width
  // for that one visible column so the cell fills the cabinet.
  useEffect(() => {
    function measure() {
      const el = reelsInnerRef.current
      if (!el) return
      const zoneW = el.clientWidth
      const zoneH = el.clientHeight
      const gapY = 6
      const baseCols = SECTIONS[currentSectionIdx]?.numCols ?? 5
      const isMobileFocus =
        typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 640px)').matches
      const numCols = isMobileFocus ? 1 : baseCols
      const sepW = 5           // reelSep width
      const gapX = 6           // reelsInner flex gap
      const numSeps = Math.max(0, numCols - 1)
      // (numCols + numSeps) flex children — gaps = (children - 1)
      const totalGaps = numCols + numSeps - 1 > 0
        ? (numCols + numSeps - 1) * gapX
        : 0
      const colW = Math.floor((zoneW - numSeps * sepW - totalGaps) / numCols)
      // Fill full zone height: 3 cells + 2 gaps fit the entire height
      const maxByHeight = Math.floor((zoneH - 2 * gapY) / 3)
      // Use height-driven sizing — cells fill the zone vertically
      const h = maxByHeight > 0 ? maxByHeight : colW
      if (h > 0) {
        setCellHeight(h)
        setZoneHeight(zoneH)
      }
    }

    measure()
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    // matchMedia listener so rotating phone (portrait↔landscape) re-measures
    const mq = window.matchMedia('(max-width: 640px)')
    const onMqChange = () => measure()
    mq.addEventListener?.('change', onMqChange)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      mq.removeEventListener?.('change', onMqChange)
    }
  }, [currentSectionIdx])

  // Update col data when section/item changes
  useEffect(() => {
    setColData(getColData(currentSectionIdx, currentItemIdx))
    // Record visit for cell memory (P0.2). Section ID + item index
    // uniquely identifies the cell that's now centered. Engine module
    // handles dwell-tracking + persistence automatically.
    const secId = SECTIONS[currentSectionIdx]?.id
    if (secId) recordVisit(secId, currentItemIdx)
  }, [currentSectionIdx, currentItemIdx])

  // ── GENESIS TIMELINE ─────────────────────────────────────────────────
  // Plays once when phase enters 'entering' and cells are measured.
  // Machine assembles itself: tab bar → headers → cells column-by-column → controls.
  useEffect(() => {
    if (!entering || cellHeight <= 0 || genesisRanRef.current) return
    genesisRanRef.current = true

    const tabBar = tabBarWrapRef.current
    const headers = reelHeadersRef.current
    const controls = controlsRef.current
    const inner = reelsInnerRef.current
    const cols = colRefs.current.filter(Boolean) as HTMLDivElement[]

    bus.emit('slot:genesis:start')

    // V9.4 — REMOVED filter:blur from genesis tweens. The CSS
    // re-rasterization on every frame of a blur tween combined with
    // the cabinet's own animated layers (aura, lens flare, voxel
    // grid) caused visible flicker on entry. Plain opacity + y +
    // scale moves are GPU-cheap and read just as cinematic.
    if (tabBar) gsap.set(tabBar, { opacity: 0, y: -36 })
    if (headers) gsap.set(headers, { opacity: 0, y: -22 })
    cols.forEach((col) => {
      gsap.set(col, { opacity: 0, scale: 0.82, y: 14 })
    })
    if (controls) gsap.set(controls, { opacity: 0, y: 48, scale: 0.78 })

    const tl = gsap.timeline()

    // ── 0.05s: Tab bar drops from above with elastic ──
    tl.to(tabBar, {
      opacity: 1, y: 0,
      duration: 0.55, ease: 'expo.out',
      onStart: () => bus.emit('slot:genesis:tabs'),
    }, 0.05)

    // ── 0.20s: Reel headers slide in + light sweep (CSS-driven) ──
    tl.to(headers, {
      opacity: 1, y: 0,
      duration: 0.55, ease: 'expo.out',
      onStart: () => {
        bus.emit('slot:genesis:headers')
        // Trigger CSS light sweep
        headers?.classList.add(styles.headersGenesis || 'headersGenesis')
        setTimeout(
          () => headers?.classList.remove(styles.headersGenesis || 'headersGenesis'),
          900,
        )
      },
    }, 0.18)

    // ── 0.40s: Cells materialize column-by-column ──
    cols.forEach((col, i) => {
      tl.to(col, {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.62,
        ease: 'expo.out',
        onStart: () => bus.emit('slot:genesis:cells', { col: i }),
      }, 0.40 + i * 0.09)
    })

    // ── 1.10s: Controls (SpinButton) rises with elastic ──
    tl.to(controls, {
      opacity: 1, y: 0, scale: 1,
      duration: 0.7, ease: 'back.out(1.6)',
      onStart: () => bus.emit('slot:genesis:controls'),
    }, 1.05)

    // ── 1.55s: Genesis complete ──
    tl.call(() => {
      bus.emit('slot:genesis:complete')
      // Brief shimmer pulse over reels zone
      if (inner) {
        const flare = document.createElement('div')
        flare.style.cssText = `
          position:absolute;inset:0;z-index:50;pointer-events:none;
          background:linear-gradient(115deg, transparent 30%, rgba(240,216,120,0.18) 48%, rgba(255,255,255,0.30) 50%, rgba(240,216,120,0.18) 52%, transparent 70%);
          mix-blend-mode:screen;opacity:0;transform:translateX(-100%);
        `
        inner.appendChild(flare)
        gsap.to(flare, {
          opacity: 1, x: '110%',
          duration: 0.65, ease: 'power2.inOut',
          onComplete: () => {
            gsap.to(flare, { opacity: 0, duration: 0.25, onComplete: () => flare.remove() })
          },
        })
      }
    }, undefined, 1.55)

    // NOTE: NO tl.kill() in cleanup. Genesis is a one-shot reveal —
    // killing it mid-flight when `entering` flips to false (because
    // TransitionDirector advances phase → 'slot' before genesis
    // completes) leaves every element at opacity:0 = BLACK SCREEN.
    // Genesis is idempotent via genesisRanRef so it never re-fires;
    // letting it run to completion in the background is safe.
  }, [entering, cellHeight])

  // Ambient project color
  useEffect(() => {
    const zone = reelsZoneRef.current
    if (!zone) return
    if (SECTIONS[currentSectionIdx]?.id === 'projects' && PROJECTS[currentItemIdx]) {
      const c = PROJECTS[currentItemIdx]!.color
      zone.style.setProperty(
        '--project-ambient',
        `radial-gradient(ellipse at 50% 50%,${c}1a 0%,${c}08 40%,transparent 70%)`
      )
    } else {
      zone.style.setProperty('--project-ambient', 'transparent')
    }
  }, [currentSectionIdx, currentItemIdx])

  // ── SPIN ANIMATION ──
  const spinToIdx = useCallback(
    (newIdx: number) => {
      if (locked || isSpinning) return
      // Block spin while payline takeover cards are visible — user must dismiss first
      if (takeoverTlRef.current || takeoverCleanupRef.current) return
      setSpinning(true)
      setSpinPhase('windup')

      // P0.4 — apply near-miss gate before the row is committed. With
      // bias enabled, jackpot rows get redirected to an adjacent non-
      // jackpot row 25% of the time. Disclosed in the DevOverlay.
      const nearMissOn = useAudioStore.getState().nearMissEnabled
      newIdx = nearMissAdjust(newIdx, currentSectionIdx, nearMissOn)

      // Set target data IMMEDIATELY so it's ready under the blur
      // When columns land and blur clears, the correct symbols are already there
      const targetData = getColData(currentSectionIdx, newIdx)
      setColData(targetData)
      setItemIdx(newIdx)

      const numCols = targetData.length
      const cols = colRefs.current.slice(0, numCols)
      const strips = stripRefs.current.slice(0, numCols)

      // Phase 1: Windup
      strips.forEach((strip, i) => {
        if (!strip) return
        gsap.to(strip, {
          y: -8,
          duration: 0.12,
          delay: i * 0.025,
          ease: 'power2.in',
        })
      })

      // Phase 2: Start spinning — pure GSAP repeat tween (CSS module keyframes are scoped, unusable via JS string)
      setTimeout(() => {
        setSpinPhase('spinning')
        if (styles.reelsZoneSpinning) reelsZoneRef.current?.classList.add(styles.reelsZoneSpinning)

        const cellStep = -(cellHeight + 6)   // one cell slot upward = items scroll down

        strips.forEach((strip, i) => {
          if (!strip) return
          gsap.killTweensOf(strip)
          gsap.set(strip, { y: 0 })
          strip.style.filter = 'blur(4px) brightness(0.68)'

          const t = gsap.to(strip, {
            y: cellStep,
            duration: 0.07,
            ease: 'none',
            repeat: -1,
            onRepeat: () => { gsap.set(strip, { y: 0 }) },
          })
          spinTweensRef.current[i] = t
        })
      }, 140)

      // Landing delays (staggered per column).
      // P0.3 ANTICIPATION REELS: high-excitement rows extend the final
      // reel's delay by up to +600ms. The 4 already-stopped reels stand
      // still while reel 5 stretches its deceleration — recruiter feels
      // the "will it land on jackpot?" tension before it does.
      const excitement = rowExcitement(currentSectionIdx, newIdx)
      const baseDelays = [560, 720, 860, 1000, 1140].slice(0, numCols)
      const delays = baseDelays.map((d, i) =>
        i === numCols - 1 ? d + Math.round(excitement * 600) : d,
      )

      // V3.8 — Anticipation reel events. When the spin is going to a
      // high-excitement row (≥ 0.4 — usually big/jackpot), broadcast
      // anticipation:start at the moment the second-to-last reel
      // lands, so the cabinet can visually + sonically build tension
      // before the final reel commits. Anticipation:end fires the
      // moment the last reel actually stops.
      if (excitement >= 0.4 && numCols >= 2) {
        const startAt = delays[numCols - 2] ?? 0
        const endAt = delays[numCols - 1] ?? 0
        setTimeout(() => {
          bus.emit('custom:slot:anticipation:start', { excitement, lastCol: numCols - 1 })
        }, startAt)
        setTimeout(() => {
          bus.emit('custom:slot:anticipation:end', {})
        }, endAt)
      }

      delays.forEach((d, i) => {
        setTimeout(() => {
          const strip = strips[i]
          const col = cols[i]
          if (!strip || !col) return

          // Stop spinning — kill GSAP tween, reset transform
          spinTweensRef.current[i]?.kill()
          spinTweensRef.current[i] = null
          gsap.set(strip, { y: 0 })
          strip.style.filter = ''

          // SPATIAL AUDIO ACCENT — per-column stereo ping at the column's
          // pan position. Fires alongside the centered reel:land synth so
          // the listener gets clear left→right tracking through headphones.
          // Volume scales down a touch for inner columns (centered ones
          // are already prominent in the central synth).
          playReelAccent(i, numCols, 0.16)

          // HAPTIC — single thud per reel landing. Last column gets the
          // emphasized pattern via slot:reel:stop subscriber in
          // HapticOrchestra; here we fire the standard land pattern for
          // every NON-last column so the user feels the reels lock down
          // one by one.
          if (i !== numCols - 1) vibrate('reel_land')

          // Phase 3: Landing pulse on column
          setSpinPhase('landing')
          gsap.fromTo(col, { scale: 1 }, {
            scale: 1.025,
            duration: 0.08,
            ease: 'power2.out',
            onComplete: () => { gsap.to(col, { scale: 1, duration: 0.1, ease: 'power2.in' }) },
          })

          // Phase 4: Snap (multi-bounce)
          setTimeout(() => {
            setSpinPhase('snapping')
            gsap.fromTo(strip,
              { y: -12, scaleY: 1 },
              {
                keyframes: [
                  { y: 8, scaleY: 0.94, scaleX: 1.03, duration: 0.086 },
                  { y: -5, scaleY: 1.03, scaleX: 0.98, duration: 0.057 },
                  { y: 4, scaleY: 0.97, scaleX: 1.015, duration: 0.067 },
                  { y: -2.5, scaleY: 1.01, duration: 0.057 },
                  { y: 1.5, scaleY: 0.99, duration: 0.057 },
                  { y: -0.8, duration: 0.048 },
                  { y: 0.4, duration: 0.048 },
                  { y: 0, scaleY: 1, scaleX: 1, duration: 0.058 },
                ],
                ease: 'none',
              }
            )
          }, 0)

          // If last column — finalize + AAA center row animation
          if (i === numCols - 1) {
            setTimeout(() => {
              if (styles.reelsZoneSpinning) reelsZoneRef.current?.classList.remove(styles.reelsZoneSpinning)
              bus.emit('slot:reel:stop', { col: numCols - 1 })
              flashWin()
              waveLanding(numCols)
              setSpinPhase('landed')
              // NOTE: setSpinning(false) is NOT called here — spin stays locked
              // until payline takeover is dismissed (cleanup calls setSpinning(false))
              tickJackpot()

              // P0.3 — emit slot:win with the bucket derived from row
              // excitement. SpeechAnnouncer, HapticOrchestra, and
              // SpatialAudio already subscribe to slot:win and react
              // appropriately ("Jackpot! Big winner!", vibration burst,
              // jackpot bloom audio), so this single emission cascades
              // the win moment across all output layers.
              const winType = excitementToWinType(excitement)
              if (winType) {
                const amount =
                  winType === 'jackpot' ? 1337 :
                  winType === 'big'     ? 500  :
                  winType === 'medium'  ? 200  :
                                          50
                bus.emit('slot:win', { type: winType, amount })
              }

              // ── AAA CENTER ROW WIN ANIMATION ──
              animateCenterRow()
            }, 280)
          }
        }, d)
      })
    },
    [locked, isSpinning, currentSectionIdx, cellHeight, setSpinning, setSpinPhase, setItemIdx, tickJackpot]
  )

  // ── AAA CENTER ROW WIN ──
  // Animates ALL center cells (middle row) with staggered golden explosion
  function animateCenterRow() {
    const inner = reelsInnerRef.current
    if (!inner) return

    // Find all center cells across all columns (data-center-cell attribute)
    const centerCells = inner.querySelectorAll('[data-center-cell]') as NodeListOf<HTMLElement>
    if (centerCells.length === 0) return

    // Staggered golden glow burst on each center cell (left → right)
    centerCells.forEach((cell, i) => {
      // Phase 1: Scale punch + golden glow (staggered 80ms per cell)
      gsap.fromTo(cell, {
        scale: 1,
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,168,75,0.35), 0 0 12px rgba(201,162,39,0.08)',
      }, {
        scale: 1.08,
        boxShadow: '0 0 40px 10px rgba(240,216,120,0.6), 0 0 80px 25px rgba(201,162,39,0.3), inset 0 0 30px rgba(240,216,120,0.25)',
        duration: 0.18,
        delay: i * 0.08,
        ease: 'power3.out',
        onComplete: () => {
          // Phase 2: Settle back with elastic ease
          gsap.to(cell, {
            scale: 1,
            boxShadow: 'inset 0 0 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(230,200,114,0.5), 0 0 22px rgba(201,162,39,0.15), 0 0 44px rgba(201,162,39,0.06)',
            duration: 0.6,
            ease: 'elastic.out(1, 0.5)',
          })
        },
      })

      // Phase 3: Border blaze
      gsap.fromTo(cell, {
        borderColor: 'rgba(255, 240, 180, 1)',
      }, {
        borderColor: 'rgba(212, 168, 75, 0.6)',
        duration: 1.2,
        delay: i * 0.08,
        ease: 'power2.out',
      })

      // Phase 4: Win sweep light beam on each cell
      cell.setAttribute('data-win', 'true')
      setTimeout(() => cell.removeAttribute('data-win'), 1800)
    })

    // Payline beam across entire reel zone
    const zone = reelsZoneRef.current
    if (zone) {
      // Create temporary payline element
      const beam = document.createElement('div')
      beam.style.cssText = `
        position: absolute;
        left: 0; right: 0;
        top: 50%;
        height: 4px;
        transform: translateY(-50%);
        z-index: 200;
        pointer-events: none;
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(240,216,120,0.7) 10%,
          rgba(255,255,255,0.95) 50%,
          rgba(240,216,120,0.7) 90%,
          transparent 100%
        );
        box-shadow:
          0 0 15px 5px rgba(240,216,120,0.5),
          0 0 40px 10px rgba(201,162,39,0.3),
          0 0 80px 20px rgba(201,162,39,0.15);
        border-radius: 2px;
        opacity: 0;
      `
      zone.appendChild(beam)

      // Animate: flash in → hold → fade out
      gsap.fromTo(beam,
        { opacity: 0, scaleX: 0 },
        {
          opacity: 1, scaleX: 1,
          duration: 0.15,
          ease: 'power3.out',
          onComplete: () => {
            // Pulse twice
            gsap.to(beam, {
              keyframes: [
                { opacity: 0.5, duration: 0.12 },
                { opacity: 1, duration: 0.12 },
                { opacity: 0.4, duration: 0.15 },
                { opacity: 0.9, duration: 0.15 },
                { opacity: 0, duration: 0.5 },
              ],
              ease: 'none',
              onComplete: () => beam.remove(),
            })
          },
        }
      )
    }

    // ── PAYLINE TAKEOVER — expanded showcase after burst ──
    setTimeout(() => paylineTakeover(), 1100)
  }

  // ── PAYLINE TAKEOVER ──
  // Two-level fullscreen showcase on document.body:
  //   Level "all"    → 5 cards at ~92% viewport width, clickable
  //   Level <number> → single card fills ~60% viewport, deep-dive
  // Navigation: ESC / overlay click / button = step back one level.
  // Button: "✦ COLLECT ✦" (all) → "◄ BACK" (single).
  function paylineTakeover() {
    const inner = reelsInnerRef.current
    if (!inner) return

    // V5.3 — UX simplification. Was: 5 cards (game/scope/work/tools/demo)
    // fly into the takeover, recruiter clicks one to deep-dive. But all
    // 5 describe the SAME project (different facets), so the picker step
    // was redundant. Now: only the GAME card (col 0) flies into the
    // takeover. Other 4 fade in place. Click on the game card opens
    // the V5.2 detail panel directly with all the project info.
    const allCenterCells = Array.from(
      inner.querySelectorAll('[data-center-cell]')
    ) as HTMLElement[]
    if (!allCenterCells.length) return

    // Cells that fly into the takeover (just the game card)
    const cells = allCenterCells.slice(0, 1)
    // Cells that stay behind, dimmed (cols 1-4 — scope/work/tools/demo)
    const dimCells = allCenterCells.slice(1)

    const vw = window.innerWidth
    const vh = window.innerHeight
    const cRects = cells.map(c => c.getBoundingClientRect())
    const cW = cRects[0]!.width
    const cH = cRects[0]!.height
    const n = cells.length  // always 1 now

    // ── Orientation ──
    const isPortrait = vh > vw

    // ── Card layout — single card, always centered ───────────────────
    // Scale limited by both width AND height so card never overflows.
    // Button area reserved at the bottom.
    const btnAreaH = Math.max(vh * 0.13, 92)
    const availH = vh - btnAreaH
    const wFrac = isPortrait ? 0.92 : 0.86
    const scaleByW = (vw * wFrac) / cW
    const scaleByH = (availH * 0.94) / cH
    const allScale = Math.min(scaleByW, scaleByH)
    const singleScale = allScale  // single-card == all-card (same layout)

    // ── Final resting position of the card in the takeover ──────────
    // Place the card CSS `left/top` so its NATURAL (unscaled) center
    // sits at viewport horizontal center + available-height vertical center.
    // This eliminates translate-math entirely — GSAP `x:0, y:0` IS center.
    const finalLeft = Math.round((vw - cW) / 2)
    const finalTop = Math.round((availH - cH) / 2)

    // ── State ──
    let level: 'all' | number = 'all'
    let pulseTween: gsap.core.Tween | null = null

    // ── DOM on document.body ──
    const overlay = document.createElement('div')
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:10000;background:rgba(2,2,8,0);cursor:pointer;',
      'backdrop-filter:blur(0px);-webkit-backdrop-filter:blur(0px);',
      'will-change:background,backdrop-filter;',
    ].join('')
    document.body.appendChild(overlay)

    const stage = document.createElement('div')
    stage.style.cssText = [
      'position:fixed;inset:0;z-index:10001;pointer-events:none;overflow:visible;',
      'touch-action:pan-y;',
    ].join('')
    document.body.appendChild(stage)

    // ── Clone center cells ──
    const cards = cells.map((cell, i) => {
      const r = cRects[i]!
      const card = document.createElement('div')
      card.className = cell.className
      card.innerHTML = cell.innerHTML

      // Card CSS position = final resting place (CENTERED, no translate needed)
      Object.assign(card.style, {
        position: 'fixed',
        left: `${finalLeft}px`,
        top: `${finalTop}px`,
        width: `${cW}px`,
        height: `${cH}px`,
        margin: '0',
        opacity: '0',
        transformOrigin: 'center center',
        zIndex: '10002',
        pointerEvents: 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
      })
      stage.appendChild(card)

      // origDx/origDy = offset from final center to original reel cell.
      // Used only for entrance animation start position.
      const origDx = Math.round(r.left - finalLeft)
      const origDy = Math.round(r.top - finalTop)

      return {
        el: card,
        allDx: 0,      // final: no x translate — CSS left IS center
        allDy: 0,      // final: no y translate — CSS top IS center
        singleDx: 0,   // single view = same center
        singleDy: 0,
        origDx,        // entrance anim start offset
        origDy,
      }
    })

    // ── Card click → deep dive ──
    cards.forEach(({ el }, i) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (level === 'all') focusCard(i)
      })
      el.addEventListener('mouseenter', () => {
        if (level === 'all') {
          gsap.to(el, {
            scale: allScale * 1.06,
            boxShadow: '0 0 60px 20px rgba(240,216,120,0.55), 0 0 110px 35px rgba(201,162,39,0.3), 0 20px 55px rgba(0,0,0,0.6)',
            duration: 0.2,
            ease: 'power2.out',
          })
        }
      })
      el.addEventListener('mouseleave', () => {
        if (level === 'all') {
          gsap.to(el, {
            scale: allScale,
            boxShadow: '0 0 40px 12px rgba(240,216,120,0.35), 0 0 80px 20px rgba(201,162,39,0.15), 0 15px 45px rgba(0,0,0,0.7)',
            duration: 0.2,
            ease: 'power2.out',
          })
        }
      })
    })

    // ── Button ──
    const btn = document.createElement('button')
    btn.textContent = '✦ COLLECT ✦'
    btn.style.cssText = `
      position:fixed;z-index:10004;pointer-events:auto;
      left:50%;bottom:${Math.max(vh * 0.05, 24)}px;
      transform:translateX(-50%);
      font-family:var(--f-ui);font-weight:800;
      font-size:clamp(13px, 1.8vw, 20px);
      letter-spacing:clamp(3px, 0.8vw, 8px);
      padding:clamp(10px, 1.8vh, 20px) clamp(28px, 5vw, 64px);
      color:#1a1408;
      background:linear-gradient(180deg,#ffe566 0%,#ffd700 30%,#daa520 70%,#b8860b 100%);
      border:2px solid rgba(255,240,180,0.8);
      border-radius:clamp(4px, 0.8vw, 8px);
      cursor:pointer;
      box-shadow:0 0 30px rgba(240,216,120,0.4),0 0 60px rgba(201,162,39,0.2),0 8px 25px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.4);
      text-shadow:0 1px 0 rgba(255,240,200,0.5);
      opacity:0;
      transition:transform 0.15s,box-shadow 0.15s;
    `
    stage.appendChild(btn)

    btn.addEventListener('mouseenter', () => {
      gsap.to(btn, { scale: 1.06, duration: 0.18, ease: 'power2.out', overwrite: true })
      btn.style.boxShadow = '0 0 50px rgba(240,216,120,0.65),0 0 90px rgba(201,162,39,0.35),0 12px 35px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.5)'
    })
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { scale: 1, duration: 0.22, ease: 'power2.out', overwrite: true })
      btn.style.boxShadow = '0 0 30px rgba(240,216,120,0.4),0 0 60px rgba(201,162,39,0.2),0 8px 25px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.4)'
    })

    // ── Step-back navigation ──
    // V5.3 — with only 1 card, the "all → single" intermediate level
    // is gone. BACK from detail goes straight to cleanup.
    function stepBack() {
      if (cards.length === 1) {
        // Single-card takeover: BACK always closes the whole thing
        settleBack()
        return
      }
      if (typeof level === 'number') {
        unfocusCard()
      } else {
        settleBack()
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.code === 'Escape') { e.preventDefault(); stepBack() }
    }

    btn.addEventListener('click', (e) => { e.stopPropagation(); stepBack() })
    overlay.addEventListener('click', stepBack)
    window.addEventListener('keydown', onKey)

    // V5.2 — track the mounted detail panel (game project deep-dive)
    let detailEl: HTMLElement | null = null

    // V5.4 — resize is now a CSS-only concern. Panel uses vw/vh
    // (handled by browser) and the card is faded out while detail
    // is open, so no JS resize handler is needed. Kept as no-op
    // for code-shape symmetry with previous versions.
    const onResize = () => { /* no-op since V5.4 */ }

    // ── Focus single card ──
    function focusCard(idx: number) {
      level = idx
      if (pulseTween) { pulseTween.kill(); pulseTween = null }

      // V6.0 — show detail panel on column 0 (hero card) for ANY
      // section that has a builder registered (projects/skills/about/
      // career/contact). Viewport must be wide enough to host panel.
      // Mobile portrait suppresses; landscape with vw≥760 enables.
      const hasRoomForDetail = vw >= 760 && vh >= 480
      const sectionId = SECTIONS[currentSectionIdx]?.id
      const showDetail =
        idx === 0 &&
        hasDetailFor(sectionId) &&
        hasRoomForDetail

      // QA fix — always clear any stale detail panel from a prior
      // focus cycle BEFORE proceeding. Repeated clicks would otherwise
      // leak the previous detailEl into the DOM.
      if (detailEl) {
        const stale = detailEl
        detailEl = null
        stale.remove()
      }

      // Fade out other cards — staggered by distance from selected
      cards.forEach(({ el }, i) => {
        if (i !== idx) {
          el.style.pointerEvents = 'none'
          gsap.to(el, {
            opacity: 0,
            scale: allScale * 0.72,
            filter: 'blur(2px)',
            duration: 0.28,
            ease: 'expo.in',
            delay: 0.02 * Math.abs(i - idx),
          })
        }
      })

      // V5.4 — when detail opens, the takeover card FADES OUT and is
      // replaced by a fullscreen-centered detail panel. Card is just
      // the entry point, panel takes over the frame.
      const card = cards[idx]!
      if (showDetail) {
        // Card collapses + fades — it morphs into the detail panel
        gsap.to(card.el, {
          opacity: 0,
          scale: singleScale * 0.88,
          filter: 'blur(8px)',
          duration: 0.36,
          ease: 'power3.in',
        })
      } else {
        // No detail (e.g. on mobile): zoom card to single-card view as before
        gsap.to(card.el, {
          x: card.singleDx,
          y: card.singleDy,
          scale: singleScale,
          boxShadow: '0 0 70px 24px rgba(240,216,120,0.5), 0 0 140px 50px rgba(201,162,39,0.22), 0 30px 70px rgba(0,0,0,0.75)',
          duration: 0.55,
          ease: 'expo.out',
        })
      }

      // V6.0 — mount fullscreen-centered detail panel (per-section)
      if (showDetail && sectionId) {
        const { html, color } = buildDetailHTML(
          sectionId,
          currentItemIdx,
          cardDetailStyles as Record<string, string | undefined>,
        )
        if (html) {
          const panel = document.createElement('div')
          panel.className = cardDetailStyles.panel ?? 'cardDetailPanel'
          panel.style.setProperty('--card-glow', color)
          // V5.4 — CENTERED full-frame detail panel. Was right-half
          // beside the card; now panel takes most of the viewport
          // with comfortable margins on all sides.
          panel.style.left = '7vw'
          panel.style.right = '7vw'
          panel.style.top = '8vh'
          panel.style.bottom = '10vh'
          panel.innerHTML = html
          // Click inside panel must NOT bubble to overlay (which
          // would call stepBack)
          panel.addEventListener('click', (e) => e.stopPropagation())
          stage.appendChild(panel)
          detailEl = panel
          // Wire BACK button + LISTEN button inside the panel
          panel.querySelector<HTMLButtonElement>('[data-detail-back]')
            ?.addEventListener('click', (e) => { e.stopPropagation(); stepBack() })
          panel.querySelector<HTMLButtonElement>('[data-detail-play]')
            ?.addEventListener('click', (e) => {
              e.stopPropagation()
              try { playSynthById('sfx_warp_ignite', 0.40) } catch { /* unlocked? */ }
            })
          // V6.0 — wire COPY button (contact section)
          panel.querySelector<HTMLButtonElement>('[data-detail-copy]')
            ?.addEventListener('click', async (e) => {
              e.stopPropagation()
              const btnEl = e.currentTarget as HTMLButtonElement
              const wrap = btnEl.closest<HTMLElement>('[data-contact-copy]')
              const text = wrap?.dataset.contactCopy ?? ''
              try {
                await navigator.clipboard?.writeText(text)
                btnEl.dataset.copied = '1'
                btnEl.textContent = 'COPIED'
                // V7.3 — affirmative ding on successful copy
                try { playSynthById('sfx_ding', 0.45) } catch { /* unlocked? */ }
                setTimeout(() => {
                  btnEl.dataset.copied = '0'
                  btnEl.textContent = 'COPY'
                }, 1400)
              } catch { /* clipboard denied */ }
            })
          // V7.1 — DOSSIER badge: opens print-optimized PDF window
          // for the recruiter. Floating top-right action so it never
          // crowds the hero or the cta row.
          if (sectionId) {
            const dBtn = document.createElement('button')
            dBtn.type = 'button'
            dBtn.className = cardDetailStyles.dossierBadge ?? 'dossierBadge'
            dBtn.dataset.detailDossier = '1'
            dBtn.textContent = 'DOSSIER'
            dBtn.title = 'Open printable one-page dossier (PDF)'
            dBtn.addEventListener('click', async (e) => {
              e.stopPropagation()
              dBtn.dataset.pending = '1'
              // V7.3 — sweep cue when the dossier window spawns
              try { playSynthById('sfx_sweep', 0.40) } catch { /* unlocked? */ }
              try {
                const cardName = panel.querySelector<HTMLElement>(
                  `.${cardDetailStyles.heroName ?? 'heroName'}`,
                )?.textContent ?? sectionId.toUpperCase()
                const { exportDossier } = await import('../../engine/DossierExport')
                exportDossier({ sectionId, itemIdx: currentItemIdx, cardName })
              } finally {
                setTimeout(() => { dBtn.dataset.pending = '0' }, 600)
              }
            })
            panel.appendChild(dBtn)
          }
          // V7.1 — DeepLink: emit detail open so URL gets /detail tail
          if (sectionId) {
            try {
              bus.emit(
                'custom:deeplink:detail_open' as 'custom:deeplink:detail_open',
                { sectionId },
              )
            } catch { /* bus not available — silent */ }
          }
        }
      }

      // Change button (only meaningful when detail is NOT shown —
      // otherwise the detail panel hosts its own BACK button)
      btn.textContent = '◄ BACK'
      gsap.fromTo(btn,
        { opacity: 0, y: 10, scale: 0.8 },
        { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.5)' }
      )
    }

    // ── Unfocus → back to all cards ──
    function unfocusCard() {
      if (typeof level !== 'number') return
      const prevIdx = level
      level = 'all'

      // V5.2 — collapse + remove detail panel
      if (detailEl) {
        const el = detailEl
        detailEl = null
        // V7.1 — DeepLink: emit detail close so URL drops the /detail tail
        try {
          bus.emit(
            'custom:deeplink:detail_close' as 'custom:deeplink:detail_close',
            undefined as never,
          )
        } catch { /* bus not available — silent */ }
        gsap.to(el, {
          opacity: 0,
          x: 36,
          filter: 'blur(8px)',
          duration: 0.32,
          ease: 'power3.in',
          onComplete: () => el.remove(),
        })
      }

      // Restore all cards to "all" positions — bloom back in
      cards.forEach(({ el, allDx, allDy }, i) => {
        el.style.pointerEvents = 'auto'
        gsap.to(el, {
          x: allDx,
          y: allDy,
          scale: allScale,
          opacity: 1,
          filter: 'blur(0px)',
          boxShadow: '0 0 40px 12px rgba(240,216,120,0.35), 0 0 80px 20px rgba(201,162,39,0.15), 0 15px 45px rgba(0,0,0,0.7)',
          duration: 0.5,
          ease: 'expo.out',
          delay: i === prevIdx ? 0 : 0.025 * Math.abs(i - prevIdx),
        })
      })

      // Restart pulse
      setTimeout(() => {
        if (level !== 'all') return
        pulseTween = gsap.to(cards.map(c => c.el), {
          boxShadow: '0 0 55px 18px rgba(240,216,120,0.5), 0 0 100px 30px rgba(201,162,39,0.25), 0 20px 55px rgba(0,0,0,0.6)',
          borderColor: 'rgba(255, 240, 180, 1)',
          duration: 1.2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        })
      }, 500)

      // Restore button
      btn.textContent = '✦ COLLECT ✦'
      gsap.fromTo(btn,
        { opacity: 0.3, y: 8, scale: 0.82 },
        { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: 'back.out(1.5)' }
      )
    }

    // ── Cleanup ──
    function cleanup() {
      if (pulseTween) { pulseTween.kill(); pulseTween = null }
      if (detailEl) {
        detailEl.remove()
        detailEl = null
        // V7.1 — emit detail close on cleanup teardown too so URL stays sane
        try {
          bus.emit(
            'custom:deeplink:detail_close' as 'custom:deeplink:detail_close',
            undefined as never,
          )
        } catch { /* silent */ }
      }
      window.removeEventListener('resize', onResize)
      overlay.remove()
      stage.remove()
      // V5.3 — reset all 5 (we dimmed allCenterCells in entry)
      allCenterCells.forEach(c => { c.style.opacity = ''; c.style.filter = '' })
      window.removeEventListener('keydown', onKey)
      // V4.3 — release cinematic flags
      document.body.removeAttribute('data-letterbox')
      document.body.removeAttribute('data-payline-active')
      takeoverTlRef.current = null
      takeoverCleanupRef.current = null
      // Unlock spin — full cycle (spin + takeover) is now complete
      setSpinning(false)
    }

    // Register cleanup for spinToIdx force-kill
    takeoverCleanupRef.current = cleanup

    // V4.3 — cinematic frame: letterbox bars slide in (thick = deeper
    // 110px bars for the takeover frame), body data-payline-active flag
    // drives a global rack-focus on whatever's behind the overlay.
    document.body.setAttribute('data-letterbox', 'thick')
    document.body.setAttribute('data-payline-active', '')

    // ── ENTER TIMELINE ──
    const enterTl = gsap.timeline()
    takeoverTlRef.current = enterTl

    // ── ENTER: initial state — card starts at original reel position ───
    // origDx/origDy places card at its reel cell origin. Extra offset
    // adds dramatic travel so fly-in feels like it's arriving from depth.
    cards.forEach(({ el, origDx, origDy }, i) => {
      const initOffY = isPortrait ? 65 : 0
      const initOffX = isPortrait ? 0 : (i < n / 2 ? -48 : 48)
      gsap.set(el, {
        opacity: 0,
        scale: allScale * 0.55,
        filter: 'blur(14px)',
        x: origDx + initOffX,   // reel origin + cinematic offset
        y: origDy + initOffY,
      })
    })

    // ── Phase 1: World goes dark + backdrop deepens ───────────────────
    enterTl.to(overlay, {
      background: 'rgba(2, 2, 8, 0.95)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      duration: 0.45,
      ease: 'power3.out',
    })
    // V5.3 — dim ALL center cells (game + scope/work/tools/demo)
    // so the entire payline drops into shadow as the takeover takes
    // over. Otherwise scope/tools cells would still glow behind the
    // dim overlay — visible artifact.
    enterTl.to(allCenterCells, {
      opacity: 0.03,
      filter: 'blur(5px) brightness(0.12)',
      duration: 0.38,
      stagger: 0.022,
      ease: 'power3.out',
    }, '<')
    void dimCells  // referenced for clarity; dim handled via allCenterCells loop above

    // ── Camera punch AT t=0 — fires BEFORE overlay covers the machine ──
    // The brief jolt is visible for the first ~0.15s (while overlay is
    // still near-transparent), then continues as a felt-not-seen motion
    // under the dark glass. Elastic return = physical weight.
    if (reelsInnerRef.current) {
      enterTl.fromTo(reelsInnerRef.current,
        { y: -7 },
        { y: 0, duration: 0.55, ease: 'elastic.out(1.1, 0.45)' },
        0  // absolute timeline start — fires before overlay opacity builds
      )
    }

    // ── Phase 2: Cards materialise — expo.out + blur dissolve ────────
    // Large initial offset + blur makes each card feel like it's
    // "arriving" from off-screen depth rather than just scaling up.
    cards.forEach(({ el, allDx, allDy }, i) => {
      enterTl.to(el, {
        opacity: 1,
        scale: allScale,
        filter: 'blur(0px)',
        x: allDx,
        y: allDy,
        boxShadow:
          '0 0 40px 12px rgba(240,216,120,0.35), 0 0 80px 20px rgba(201,162,39,0.15), 0 15px 45px rgba(0,0,0,0.7)',
        duration: isPortrait ? 0.68 : 0.78,
        ease: 'expo.out',
        onComplete: () => { el.style.pointerEvents = 'auto' },
      }, i === 0 ? '-=0.12' : `<${isPortrait ? 0.062 : 0.072}`)
    })

    // Phase 3: Button rises from bottom
    enterTl.fromTo(btn,
      { opacity: 0, y: 18, scale: 0.75 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.7)' },
      '-=0.25'
    )

    // Phase 4: Start pulse (separate tween, not on timeline)
    enterTl.call(() => {
      pulseTween = gsap.to(cards.map(c => c.el), {
        boxShadow: '0 0 55px 18px rgba(240,216,120,0.5), 0 0 100px 30px rgba(201,162,39,0.25), 0 20px 55px rgba(0,0,0,0.6)',
        borderColor: 'rgba(255, 240, 180, 1)',
        duration: 1.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
    })

    // ── SETTLE BACK → cinematic implode ───────────────────────────────
    function settleBack() {
      if (pulseTween) { pulseTween.kill(); pulseTween = null }
      enterTl.kill()

      const exitTl = gsap.timeline({ onComplete: cleanup })
      takeoverTlRef.current = exitTl

      // Button vaporises instantly — don't let it linger
      exitTl.to(btn, {
        opacity: 0, y: 16, scale: 0.65,
        duration: 0.18, ease: 'power3.in',
      })

      // ── Cards implode in forward order ────────────────────────────────
      // Each card: brief scale pulse (no brightness flash) → collapse to
      // near-zero with blur, accelerating hard (power3.in).
      // Forward stagger (0→4) = "vacuum pull" into the machine center.
      // NO brightness spikes — clean scale + blur only.
      cards.forEach(({ el }, i) => {
        const t = 0.06 + i * 0.038  // stagger start (absolute tl position)

        // 1. Brief scale pulse — card swells slightly before collapsing
        exitTl.to(el, {
          scale: allScale * 1.05,
          duration: 0.09,
          ease: 'power2.out',
        }, t)

        // 2. Implode — slam back to origin, shrink to a point, blur out
        exitTl.to(el, {
          x: 0,
          y: 0,
          scale: allScale * 0.06,
          opacity: 0,
          filter: 'blur(12px)',
          boxShadow: '0 0 0 0 transparent',
          duration: 0.36,
          ease: 'power3.in',
        }, t + 0.09)
      })

      // Overlay + blur dissolve — overlaps with last card imploding
      const lastImplosionStart = 0.06 + (cards.length - 1) * 0.038 + 0.07
      exitTl.to(overlay, {
        background: 'rgba(2, 2, 8, 0)',
        backdropFilter: 'blur(0px)',
        WebkitBackdropFilter: 'blur(0px)',
        duration: 0.42,
        ease: 'power2.out',
      }, lastImplosionStart - 0.05)

      // V5.3 — restore ALL center cells (was: just `cells`, now we
      // dimmed all 5 in the entry, so all 5 must bloom back).
      exitTl.to(allCenterCells, {
        opacity: 1,
        filter: 'none',
        duration: 0.30,
        stagger: 0.022,
        ease: 'power2.out',
      }, lastImplosionStart)
    }
  }

  function flashWin() {
    const f = flashRef.current
    if (!f) return
    gsap.fromTo(f, { opacity: 1 }, { opacity: 0, duration: 0.1, delay: 0 })
  }

  function waveLanding(numCols: number) {
    // Pulse each center cell strip slightly
    stripRefs.current.slice(0, numCols).forEach((strip, i) => {
      if (!strip) return
      setTimeout(() => {
        gsap.fromTo(strip, { scale: 1.025 }, { scale: 1, duration: 0.08, delay: 0 })
      }, i * 45)
    })
  }

  // Spin button → advance to next item via persona-driven targeting (P4.3).
  // Old behavior was `(currentItemIdx + 1) % length` — linear, dumb,
  // happily landed on already-seen rows. New behavior consults
  // PersonaInference (which kind of recruiter is this) + CellMemory
  // (what have they already seen) and picks the most useful next row.
  // Blocked while locked (intro), spinning, or payline takeover cards on screen.
  const handleSpin = useCallback(() => {
    if (locked || isSpinning || takeoverTlRef.current || takeoverCleanupRef.current) return
    bus.emit('slot:spin:start')
    const arr = getDataForSection(currentSectionIdx)
    const secId = SECTIONS[currentSectionIdx]?.id ?? 'projects'
    const newIdx = pickNextItem({
      sectionIdx: currentSectionIdx,
      currentIdx: currentItemIdx,
      itemCount: arr.length,
      persona: getCurrentPersona(),
      isVisited: (i) => isCellVisited(secId, i),
      rowExcitement: (i) => rowExcitement(currentSectionIdx, i),
    })
    spinToIdx(newIdx)
  }, [locked, isSpinning, currentSectionIdx, currentItemIdx, spinToIdx])

  // Game cell click — blocked during intro/takeover
  const handleGameCellClick = useCallback((itemIndex: number) => {
    if (locked || isSpinning || takeoverTlRef.current || takeoverCleanupRef.current || itemIndex === currentItemIdx) return
    spinToIdx(itemIndex)
  }, [locked, isSpinning, currentItemIdx, spinToIdx])

  // Section change — wrapped in View Transitions where supported.
  // The browser captures the OLD frame, runs the React state update,
  // captures the NEW frame, then cross-dissolves between them with
  // optional CSS animation hooks (we add a custom slot-section-cross
  // ::view-transition-old / ::view-transition-new pair in CSS).
  // On unsupported browsers (anything without document.startViewTransition)
  // it falls back to a plain setSection call — instant cut, no break.
  const handleSectionChange = useCallback((idx: number) => {
    if (locked || isSpinning || idx === currentSectionIdx) return
    const docVt = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> }
    }
    if (typeof docVt.startViewTransition === 'function') {
      // Tag the body so our @view-transition CSS can scope the animation
      // to section changes only (vs. any other future VT we might add).
      document.body.setAttribute('data-vt', 'section-change')
      const vt = docVt.startViewTransition(() => setSection(idx))
      vt.finished.finally(() => document.body.removeAttribute('data-vt'))
    } else {
      setSection(idx)
    }
  }, [locked, isSpinning, currentSectionIdx, setSection])

  // ── TOUCH HANDLING ──
  const touchStateRef = useRef({ startX: 0, startY: 0, swiping: false, scrolling: false })

  // Swipe on whole zone (section change)
  const handleZoneTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]!
    touchStateRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, scrolling: false }
  }, [])

  const handleZoneTouchMove = useCallback((e: React.TouchEvent) => {
    if (locked || isSpinning) return
    const t = e.touches[0]!
    const dx = t.clientX - touchStateRef.current.startX
    const dy = t.clientY - touchStateRef.current.startY
    if (!touchStateRef.current.scrolling && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      touchStateRef.current.swiping = true
      setShowSecL(dx > 0)
      setShowSecR(dx < 0)
    }
  }, [locked, isSpinning])

  const handleZoneTouchEnd = useCallback((e: React.TouchEvent) => {
    setShowSecL(false)
    setShowSecR(false)
    if (locked || isSpinning) return
    const t = e.changedTouches[0]!
    const dx = t.clientX - touchStateRef.current.startX
    const dy = t.clientY - touchStateRef.current.startY
    if (touchStateRef.current.swiping && Math.abs(dx) > 60) {
      const next = dx > 0
        ? (currentSectionIdx - 1 + SECTIONS.length) % SECTIONS.length
        : (currentSectionIdx + 1) % SECTIONS.length
      handleSectionChange(next)
    } else if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
      // Vertical swipe on game reel = change item
      const dir = dy < 0 ? 1 : -1
      const steps = Math.min(3, Math.max(1, Math.floor(Math.abs(dy) / 60)))
      const arr = getDataForSection(currentSectionIdx)
      const newIdx = ((currentItemIdx + dir * steps) % arr.length + arr.length) % arr.length
      spinToIdx(newIdx)
    }
  }, [locked, isSpinning, currentSectionIdx, currentItemIdx, handleSectionChange, spinToIdx])

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleSpin() }
      if (e.code === 'ArrowLeft') handleSectionChange((currentSectionIdx - 1 + SECTIONS.length) % SECTIONS.length)
      if (e.code === 'ArrowRight') handleSectionChange((currentSectionIdx + 1) % SECTIONS.length)
      if (e.code === 'ArrowUp') {
        const arr = getDataForSection(currentSectionIdx)
        const newIdx = (currentItemIdx - 1 + arr.length) % arr.length
        spinToIdx(newIdx)
      }
      if (e.code === 'ArrowDown') {
        const arr = getDataForSection(currentSectionIdx)
        const newIdx = (currentItemIdx + 1) % arr.length
        spinToIdx(newIdx)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleSpin, handleSectionChange, currentSectionIdx, currentItemIdx, spinToIdx])

  // ── Spatial audio: payline travel + jackpot bloom ──────────────────
  // Layer stereo accents on top of the centered slot:win synth. The
  // travel sweep pans L→R as the payline reveals; the jackpot bloom
  // fires a wide center hit with stereo halo for jackpot-class wins.
  useEffect(() => {
    const off = bus.on('slot:win', (p) => {
      playPaylineTravel(850, 0.12)
      if (p?.type === 'jackpot') playJackpotBloom(0.22)
    })
    return off
  }, [])

  // ── Gamepad item nav (D-pad up/down) — same path as ArrowUp/Down ──
  useEffect(() => {
    const offUp = bus.on('custom:item_prev' as 'custom:item_prev', () => {
      if (locked || isSpinning) return
      const arr = getDataForSection(currentSectionIdx)
      const newIdx = (currentItemIdx - 1 + arr.length) % arr.length
      spinToIdx(newIdx)
    })
    const offDown = bus.on('custom:item_next' as 'custom:item_next', () => {
      if (locked || isSpinning) return
      const arr = getDataForSection(currentSectionIdx)
      const newIdx = (currentItemIdx + 1) % arr.length
      spinToIdx(newIdx)
    })
    return () => { offUp(); offDown() }
  }, [locked, isSpinning, currentSectionIdx, currentItemIdx, spinToIdx])

  // ── Voice command subscribers ───────────────────────────────────────
  // Bridges Web Speech API → existing nav/spin handlers. Voice commands
  // are dispatched as bus events from VoiceControl.ts; here we translate
  // each into the same handler the keyboard / pointer paths use, so
  // every code path goes through the same locked/spinning guards.
  useEffect(() => {
    const offSpin = bus.on('voice:command:spin', () => handleSpin())
    const offNext = bus.on('voice:command:next', () =>
      handleSectionChange((currentSectionIdx + 1) % SECTIONS.length))
    const offBack = bus.on('voice:command:back', () =>
      handleSectionChange((currentSectionIdx - 1 + SECTIONS.length) % SECTIONS.length))
    // "jackpot" easter egg — bumps the jackpot ticker visibly + emits the
    // win event so the casino-shower / SFX hook can react. Doesn't actually
    // award credits (it's a demo gesture, not a casino).
    const offJackpot = bus.on('voice:command:jackpot', () => {
      tickJackpot()
      bus.emit('slot:win', { type: 'jackpot', amount: 1000 })
    })
    // ReachPill "REACH OUT ↗" click — jump directly to REACH tab (section 4)
    const offReach = bus.on('custom:go_to_reach' as 'custom:go_to_reach', () => {
      if (!locked) handleSectionChange(SECTIONS.length - 1)
    })
    return () => { offSpin(); offNext(); offBack(); offJackpot(); offReach() }
  }, [handleSpin, handleSectionChange, currentSectionIdx, tickJackpot, locked])

  const section = SECTIONS[currentSectionIdx]!

  // stripTop: positions cell[3] at center of the 3-row window
  // Column height = 3*cellH + 12. Center = 1.5*cellH + 6.
  // cell[3] center = stripTop + 3*(cellH+6) + cellH/2 = center → stripTop = -2*(cellH+6)
  const stripTop = cellHeight > 0 ? -2 * (cellHeight + 6) : 0

  // Map spinPhase → CSS module class for per-column state overlay (motion trail / halo / chromatic snap)
  const phaseSpinClass =
    spinPhase === 'windup' ? (styles.windup || 'windup')
    : spinPhase === 'spinning' ? (styles.spinning || 'spinning')
    : spinPhase === 'snapping' ? (styles.snapping || 'snapping')
    : spinPhase === 'landing' ? (styles.landing || 'landing')
    : ''

  // Ambient phase attribute drives the machine-wide ambient glow backdrop
  const ambientPhase: 'idle' | 'spinning' | 'landing' =
    spinPhase === 'spinning' || spinPhase === 'windup' ? 'spinning'
    : spinPhase === 'landing' || spinPhase === 'snapping' || spinPhase === 'landed' ? 'landing'
    : 'idle'

  return (
    <div
      ref={machineRef}
      className={styles.machine}
      data-ambient-phase={ambientPhase}
      data-cabinet-shake-target=""
    >
      {/* V8.0 — Audio-reactive backdrop bloom: three radial spotlights
          tinted by section/persona, scaled by live FFT. Sits behind
          everything else inside the cabinet. */}
      <CabinetAura />

      {/* V3.7 — World parallax layers (far nebula + mid grid + near
          sparkle field reactive to spin). All position:fixed behind
          the cabinet. */}
      <CabinetWorld />

      {/* V9.4 — Tron voxel floor REMOVED per user feedback. The
          perspective grid + animated drop-shadow combo was reading
          as flicker noise under the cabinet. Module kept in
          ./cabinet/CabinetVoxelFloor.tsx for future re-enable. */}

      {/* V7.2 — Affinity connection lines REMOVED per user feedback.
          Hover-triggered bezier paths read as visual noise on top of
          the cabinet, not as a signal. Module kept (CabinetConnectionLines)
          but no longer mounted. Re-enable here if you want them back. */}

      {/* CSS Houdini Paint — procedural cyberpunk circuit-grid base
          (paint(cyberPattern) on Chromium-based browsers; falls back
          to a radial gradient on Safari/Firefox via CSS layering). */}
      <div className={styles.cyberPaintBg} aria-hidden="true" />

      {/* V3.0 — Cabinet marquee (top scrolling brand ticker) */}
      <CabinetMarquee />

      {/* Tab Bar */}
      <TabBar
        ref={tabBarWrapRef}
        sections={SECTIONS}
        activeSectionIdx={currentSectionIdx}
        onChange={handleSectionChange}
        disabled={isSpinning}
      />

      {/* V3.0 — Info HUD strip (SECTION · VISITED · STREAK · JACKPOT · PERSONA) */}
      <CabinetHUD />

      {/* Reel Headers */}
      <div ref={reelHeadersRef} className={styles.reelHeaders}>
        <div className={styles.reelHeadersInner}>
          {section.headers.map((h, i) => (
            <div key={i} style={{ display: 'contents' }}>
              {i > 0 && <div className={styles.reelHeaderSep} />}
              <div className={`${styles.reelHeader} ${i === 0 ? styles.reelHeaderActive : ''}`}>
                <span className={styles.reelHeaderIcon}>{section.headerIcons[i]}</span>
                <span className={styles.reelHeaderLabel}>{h}</span>
                <div className={styles.reelHeaderBar} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Frame + Reels zone */}
      <div className={styles.frameWrapper}>
        {/* §2.7 — Cinematic depth vignette (dark radial edge) */}
        <div className={styles.depthVignette} aria-hidden="true" />
        {/* Center payline gold spotlight line — draws eye to active row */}
        <div className={styles.centerRowLine} aria-hidden="true" />
        <Frame isSpinning={isSpinning} cellHeight={cellHeight}>
          <div
            ref={reelsZoneRef}
            className={`${styles.reelsZone} ${isSpinning ? styles.reelsZoneSpinning : ''}`}
            style={cellHeight > 0 ? { '--cell-h': `${cellHeight}px` } as React.CSSProperties : undefined}
            onTouchStart={handleZoneTouchStart}
            onTouchMove={handleZoneTouchMove}
            onTouchEnd={handleZoneTouchEnd}
          >
            {/* Section direction indicators */}
            <div className={`${styles.secIndicator} ${styles.secIndicatorLeft} ${showSecL ? styles.secIndicatorShow : ''}`}>‹</div>
            <div className={`${styles.secIndicator} ${styles.secIndicatorRight} ${showSecR ? styles.secIndicatorShow : ''}`}>›</div>

            {/* Flash overlay */}
            <div ref={flashRef} className={styles.flash} />

            {/* Reels inner */}
            <div ref={reelsInnerRef} className={styles.reelsInner}>
              {cellHeight > 0 && colData.map((cells, ci) => (
                // P4.4 — data-col-index lets the mobile media query
                // hide cols 1..N-1 (CSS-only) so the hero tile expands
                // to fill the cabinet on ≤640px viewports.
                <div key={ci} style={{ display: 'contents' }} data-col-index={ci}>
                  {ci > 0 && <div className={styles.reelSep} />}
                  <ReelColumn
                    ref={(el: HTMLDivElement | null) => {
                      colRefs.current[ci] = el
                      if (el) {
                        stripRefs.current[ci] = el.querySelector('[data-strip]') as HTMLDivElement
                      }
                    }}
                    cells={cells}
                    colIndex={ci}
                    cellHeight={cellHeight}
                    stripTop={stripTop}
                    isGameReel={ci === 0}
                    spinClass={phaseSpinClass}
                    onGameCellClick={handleGameCellClick}
                  />
                </div>
              ))}
            </div>

            {/* P4.4 — reel deck (mobile only). Tells the recruiter
                "there are 4 more reels behind this one — tap a card to
                deep-dive and you'll see them all in the takeover".
                CSS-only visibility (display:none on desktop). */}
            {cellHeight > 0 && colData.length > 1 && (
              <div className={styles.mobileReelDeck} aria-hidden="true">
                {colData.map((_, ci) => (
                  <span
                    key={ci}
                    className={`${styles.deckPip} ${ci === 0 ? styles.deckPipActive : ''}`}
                  />
                ))}
                <span className={styles.deckHint}>
                  TAP CARD TO REVEAL ALL REELS
                </span>
              </div>
            )}

            {/* Swipe hint */}
            <div className={styles.swipeHint}>
              ↕ SWIPE TO BROWSE &nbsp;·&nbsp; TAP TO SELECT
            </div>
          </div>
        </Frame>
      </div>

      {/* V3.0 — Win strip (LAST WIN · COMBO meter) */}
      <CabinetWinStrip />

      {/* V3.5 — Control deck — AUTO · BET- · SPIN · BET+ · MAX */}
      <div ref={controlsRef} className={styles.controls}>
        <CabinetControlDeck
          isSpinning={isSpinning}
          credits={credits}
          jackpot={jackpot}
          onSpin={handleSpin}
        />
      </div>

      {/* V3.0 — Sub-frame ticker (AVAILABLE FOR HIRE · contact)
          Replaces V1 bottomStrip, gives recruiters a permanent
          one-line CTA at the cabinet base. */}
      <CabinetSubFrame />

      {/* V3.6 — cinematic win overlay. Listens for slot:win and
          renders a per-tier fullscreen FX layer. Pointer-events-none
          so it never blocks interaction. */}
      <CabinetWinFx />

      {/* V3.8 — last-reel anticipation. Shows a glitchy "?" hologram
          + warp audio rampa when a high-excitement spin is about to
          land. Cleared the moment the last reel commits. */}
      <CabinetAnticipation />

      {/* V4.0 — cinematic camera. Sets body[data-camera] on
          spin/reel-stop/win/cell-click events; CSS in styles/index.css
          drives viewport-level shakes + idle-float. */}
      <CabinetCamera />

      {/* V4.1 — anamorphic lens flare. Horizontal bright streak +
          vertical bloom on final reel stop / win. Tier-scaled
          intensity, jackpot adds radial sunburst. */}
      <CabinetLensFlare />

      {/* V5.1 connection lines REMOVED from active flow on Boki's
          request — module stays in cabinet/ folder unused so a
          future "show affinities" toggle can re-enable it. */}
    </div>
  )
}

export default SlotMachine
