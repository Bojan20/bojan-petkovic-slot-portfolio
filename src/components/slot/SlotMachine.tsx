import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useSlotStore } from '../../store'
import { PROJECTS, SKILLS_DATA, ABOUT_DATA, EXP_DATA, CONTACT_DATA, SECTIONS } from '../../data'
import type { CellData } from '../../types'
import { TabBar } from './TabBar'
import { Frame } from './Frame'
import { ReelColumn } from './ReelColumn'
import { SpinButton } from './SpinButton'
import styles from './SlotMachine.module.css'

const STRIP_ROWS = 7

function wrap<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length]!
}

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

function getColData(sectionIdx: number, centerIdx: number): CellData[][] {
  const half = 3
  const n = STRIP_ROWS
  const arr = getDataForSection(sectionIdx)
  const secId = SECTIONS[sectionIdx]!.id

  // ── PROJECTS: 5 cols — GAME | SCOPE | WORK | TOOLS | DEMO
  if (secId === 'projects') {
    const cols: CellData[][] = [[], [], [], [], []]
    for (let k = 0; k < n; k++) {
      const p = wrap(arr as typeof PROJECTS, centerIdx - half + k) as typeof PROJECTS[0]
      const isC = k === half
      const itemIndex = ((centerIdx - half + k) % arr.length + arr.length) % arr.length
      cols[0]!.push({ type: 'game',  ico: p.ico, name: p.name, studio: p.studio, color: p.color, center: isC, itemIndex })
      cols[1]!.push({ type: 'scope', scope: p.scope, color: p.color, center: isC })
      cols[2]!.push({ type: 'detail', text: p.work, color: p.color, center: isC })
      cols[3]!.push({ type: 'tools', tools: p.tools, color: p.color, center: isC })
      cols[4]!.push({ type: 'demo',  demo: p.demo, color: p.color, center: isC })
    }
    return cols
  }

  // ── SKILLS: 5 cols — SKILL | LEVEL | DETAILS | TOOLS | DOMAIN
  if (secId === 'skills') {
    const cols: CellData[][] = [[], [], [], [], []]
    for (let k = 0; k < n; k++) {
      const s = wrap(arr as typeof SKILLS_DATA, centerIdx - half + k) as typeof SKILLS_DATA[0]
      const isC = k === half
      const itemIndex = ((centerIdx - half + k) % arr.length + arr.length) % arr.length
      cols[0]!.push({ type: 'simple', ico: s.ico, name: s.name, studio: '', color: s.color, center: isC, itemIndex })
      cols[1]!.push({ type: 'tools',  tools: [s.level], color: s.color, center: isC })
      cols[2]!.push({ type: 'detail', text: s.desc, color: s.color, center: isC })
      cols[3]!.push({ type: 'tools',  tools: s.tools, color: s.color, center: isC })
      cols[4]!.push({ type: 'tools',  tools: [s.domain], color: s.color, center: isC })
    }
    return cols
  }

  // ── ABOUT: 5 cols — PROFILE | CONTEXT | STORY | FACTS | FOCUS
  if (secId === 'about') {
    const cols: CellData[][] = [[], [], [], [], []]
    for (let k = 0; k < n; k++) {
      const d = wrap(arr as typeof ABOUT_DATA, centerIdx - half + k) as typeof ABOUT_DATA[0]
      const isC = k === half
      const itemIndex = ((centerIdx - half + k) % arr.length + arr.length) % arr.length
      cols[0]!.push({ type: 'simple', ico: d.ico, name: d.name, studio: '',           color: d.color, center: isC, itemIndex })
      cols[1]!.push({ type: 'detail', text: d.period || '',                            color: d.color, center: isC })
      cols[2]!.push({ type: 'detail', text: d.desc,                                   color: d.color, center: isC })
      cols[3]!.push({ type: 'tools',  tools: (d.highlights || []).slice(0, 3),        color: d.color, center: isC })
      cols[4]!.push({ type: 'tools',  tools: (d.highlights || []).slice(3),           color: d.color, center: isC })
    }
    return cols
  }

  // ── CAREER: 5 cols — COMPANY | PERIOD | ROLE | SCOPE | IMPACT
  if (secId === 'career') {
    const cols: CellData[][] = [[], [], [], [], []]
    for (let k = 0; k < n; k++) {
      const d = wrap(arr as typeof EXP_DATA, centerIdx - half + k) as typeof EXP_DATA[0]
      const isC = k === half
      const itemIndex = ((centerIdx - half + k) % arr.length + arr.length) % arr.length
      cols[0]!.push({ type: 'simple', ico: d.ico, name: d.name, studio: '',           color: d.color, center: isC, itemIndex })
      cols[1]!.push({ type: 'detail', text: d.period || '',                            color: d.color, center: isC })
      cols[2]!.push({ type: 'detail', text: d.desc,                                   color: d.color, center: isC })
      cols[3]!.push({ type: 'tools',  tools: (d.highlights || []).slice(0, 2),        color: d.color, center: isC })
      cols[4]!.push({ type: 'tools',  tools: (d.highlights || []).slice(2),           color: d.color, center: isC })
    }
    return cols
  }

  // ── CONTACT: 5 cols — CHANNEL | TYPE | VALUE | STATUS | NOTE
  const cols: CellData[][] = [[], [], [], [], []]
  for (let k = 0; k < n; k++) {
    const d = wrap(arr as typeof CONTACT_DATA, centerIdx - half + k) as typeof CONTACT_DATA[0]
    const isC = k === half
    const itemIndex = ((centerIdx - half + k) % arr.length + arr.length) % arr.length
    cols[0]!.push({ type: 'simple', ico: d.ico, name: d.name, studio: '',             color: d.color, center: isC, itemIndex })
    cols[1]!.push({ type: 'detail', text: d.period || '',                              color: d.color, center: isC })
    cols[2]!.push({ type: 'detail', text: d.desc,                                     color: d.color, center: isC })
    cols[3]!.push({ type: 'tools',  tools: d.highlights || [],                        color: d.color, center: isC })
    cols[4]!.push({ type: 'detail', text: d.note || '',                               color: d.color, center: isC })
  }
  return cols
}

export function SlotMachine() {
  const {
    currentSectionIdx,
    currentItemIdx,
    isSpinning,
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
  const [zoneHeight, setZoneHeight] = useState(0)
  const reelsInnerRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const reelsZoneRef = useRef<HTMLDivElement>(null)
  const stripRefs = useRef<(HTMLDivElement | null)[]>([])
  const colRefs = useRef<(HTMLDivElement | null)[]>([])

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
  // Calculate column width mathematically (no DOM chicken-and-egg)
  useEffect(() => {
    function measure() {
      const el = reelsInnerRef.current
      if (!el) return
      const zoneW = el.clientWidth
      const zoneH = el.clientHeight
      const gapY = 6
      const numCols = SECTIONS[currentSectionIdx]?.numCols ?? 5
      const sepW = 5           // reelSep width
      const gapX = 6           // reelsInner flex gap
      const numSeps = numCols - 1
      // 9 flex children (5 cols + 4 seps) = 8 gaps total
      const totalGaps = (numCols + numSeps - 1) * gapX
      const colW = Math.floor((zoneW - numSeps * sepW - totalGaps) / numCols)
      const maxByHeight = Math.floor((zoneH - 2 * gapY) / 3)
      // Square: use colWidth, but cap to fit 3 rows in available height
      const h = colW > 0 ? Math.min(colW, maxByHeight) : maxByHeight
      if (h > 0) {
        setCellHeight(h)
        setZoneHeight(zoneH)
      }
    }

    measure()
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [currentSectionIdx])

  // Update col data when section/item changes
  useEffect(() => {
    setColData(getColData(currentSectionIdx, currentItemIdx))
  }, [currentSectionIdx, currentItemIdx])

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
      if (isSpinning) return
      setSpinning(true)
      setSpinPhase('windup')

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

      // Landing delays (staggered per column)
      const delays = [560, 720, 860, 1000, 1140].slice(0, numCols)

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
              flashWin()
              waveLanding(numCols)
              setSpinPhase('landed')
              setSpinning(false)
              tickJackpot()
              // ── AAA CENTER ROW WIN ANIMATION ──
              animateCenterRow()
            }, 280)
          }
        }, d)
      })
    },
    [isSpinning, currentSectionIdx, cellHeight, setSpinning, setSpinPhase, setItemIdx, tickJackpot]
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

  // Spin button → advance to next item
  const handleSpin = useCallback(() => {
    if (isSpinning) return
    const arr = getDataForSection(currentSectionIdx)
    const newIdx = (currentItemIdx + 1) % arr.length
    spinToIdx(newIdx)
  }, [isSpinning, currentSectionIdx, currentItemIdx, spinToIdx])

  // Game cell click
  const handleGameCellClick = useCallback((itemIndex: number) => {
    if (isSpinning || itemIndex === currentItemIdx) return
    spinToIdx(itemIndex)
  }, [isSpinning, currentItemIdx, spinToIdx])

  // Section change
  const handleSectionChange = useCallback((idx: number) => {
    if (isSpinning || idx === currentSectionIdx) return
    setSection(idx)
  }, [isSpinning, currentSectionIdx, setSection])

  // ── TOUCH HANDLING ──
  const touchStateRef = useRef({ startX: 0, startY: 0, swiping: false, scrolling: false })

  // Swipe on whole zone (section change)
  const handleZoneTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]!
    touchStateRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, scrolling: false }
  }, [])

  const handleZoneTouchMove = useCallback((e: React.TouchEvent) => {
    if (isSpinning) return
    const t = e.touches[0]!
    const dx = t.clientX - touchStateRef.current.startX
    const dy = t.clientY - touchStateRef.current.startY
    if (!touchStateRef.current.scrolling && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      touchStateRef.current.swiping = true
      setShowSecL(dx > 0)
      setShowSecR(dx < 0)
    }
  }, [isSpinning])

  const handleZoneTouchEnd = useCallback((e: React.TouchEvent) => {
    setShowSecL(false)
    setShowSecR(false)
    if (isSpinning) return
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
  }, [isSpinning, currentSectionIdx, currentItemIdx, handleSectionChange, spinToIdx])

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

  const section = SECTIONS[currentSectionIdx]!

  // stripTop: positions cell[3] at center of the 3-row window
  // Column height = 3*cellH + 12. Center = 1.5*cellH + 6.
  // cell[3] center = stripTop + 3*(cellH+6) + cellH/2 = center → stripTop = -2*(cellH+6)
  const stripTop = cellHeight > 0 ? -2 * (cellHeight + 6) : 0

  return (
    <div className={styles.machine}>
      {/* Tab Bar */}
      <TabBar
        sections={SECTIONS}
        activeSectionIdx={currentSectionIdx}
        onChange={handleSectionChange}
        disabled={isSpinning}
      />

      {/* Reel Headers */}
      <div className={styles.reelHeaders}>
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
                <div key={ci} style={{ display: 'contents' }}>
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
                    onGameCellClick={handleGameCellClick}
                  />
                </div>
              ))}
            </div>

            {/* Swipe hint */}
            <div className={styles.swipeHint}>
              ↕ SWIPE TO BROWSE &nbsp;·&nbsp; TAP TO SELECT
            </div>
          </div>
        </Frame>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <SpinButton
          isSpinning={isSpinning}
          credits={credits}
          jackpot={jackpot}
          onClick={handleSpin}
        />
      </div>

      {/* Bottom strip */}
      <div className={styles.bottomStrip}>
        <div className={styles.bottomLeft}>VANVINKL STUDIO</div>
        <div className={styles.bottomCenter}>PORTFOLIO · 2026</div>
        <div className={styles.bottomRight}>
          <span className={styles.jpLbl}>JACKPOT</span>
          <span className={styles.jpVal}>${jackpot.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

export default SlotMachine
