/**
 * CinematicTeaser — 30-second auto-play montage between SplashScreen
 * and SlotMachine. Recruiter who has 30 seconds gets a complete
 * narrative; recruiter who wants depth still hits the slot afterwards.
 *
 * Five-scene timeline (GSAP-driven):
 *
 *   00.0–04.0s  HERO         "BOJAN PETKOVIĆ" + "AUDIO DIRECTOR"
 *   04.0–09.0s  METRIC       8+ years · 50+ titles · 200+ SFX · 0 defects
 *   09.0–22.0s  PROJECTS     6 cycling project tiles (~2.16s each)
 *   22.0–27.0s  TOOLS        badge cloud — Wwise, Pro Tools, Reaper, …
 *   27.0–30.0s  CTA          "EXPLORE FULL PORTFOLIO ↓"
 *
 * onComplete → caller advances to 'entering' → 'slot'. Skip Intro
 * pill (SkipIntroButton) calls TransitionDirector.skip() which
 * shortcuts to 'slot'. Both routes end at the same place; the skip
 * just bypasses 30 seconds of choreography.
 *
 * Cinematic chrome:
 *   • 9.5vh letterbox bars top + bottom (cinematic 21:9 feel)
 *   • Animated film grain overlay (1.2s steps shift, 0.08 opacity)
 *   • Subtle CRT scanlines
 *   • Radial vignette dark at edges, transparent at center
 *   • Bottom progress bar — sweeps left→right over 30s
 */

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import styles from './CinematicTeaser.module.css'
import { PROJECTS } from '../data'

interface CinematicTeaserProps {
  /** Called when the 30s timeline naturally completes. */
  onComplete: () => void
}

const TOTAL_DURATION = 30
const TOOLS = ['WWISE', 'FMOD', 'PRO TOOLS', 'REAPER', 'CUBASE', 'ABLETON', 'UNREAL', 'UNITY', 'WORKING WITH AUDIO TEAMS']

// Hoisted out of the component so the reference is stable —
// putting this inside the component caused the master useEffect to
// re-run on every projectIdx change (new array reference per render),
// which killed the in-flight timeline and snapped scenes back to
// their initial state mid-cycle. With a stable reference + an empty
// deps array, the timeline is built ONCE and survives re-renders.
const PROJECTS_TO_SHOW = PROJECTS.slice(0, 6)

export function CinematicTeaser({ onComplete }: CinematicTeaserProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const heroSceneRef = useRef<HTMLDivElement>(null)
  const metricSceneRef = useRef<HTMLDivElement>(null)
  const projectSceneRef = useRef<HTMLDivElement>(null)
  const toolsSceneRef = useRef<HTMLDivElement>(null)
  const ctaSceneRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Active project index for the rotation in the project scene.
  // Updates discretely via GSAP timeline calls; React state used so
  // each tile re-renders with new data without DOM-imperative ops.
  const [projectIdx, setProjectIdx] = useState(0)

  const projectScene = PROJECTS_TO_SHOW[projectIdx] ?? PROJECTS_TO_SHOW[0]!

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      // Reduced motion — skip the cinematic, hand control to slot.
      const t = setTimeout(onComplete, 600)
      return () => clearTimeout(t)
    }

    const heroScene = heroSceneRef.current
    const metricScene = metricSceneRef.current
    const projectScene = projectSceneRef.current
    const toolsScene = toolsSceneRef.current
    const ctaScene = ctaSceneRef.current
    const progress = progressRef.current

    // All scenes start hidden
    gsap.set([heroScene, metricScene, projectScene, toolsScene, ctaScene], { opacity: 0 })

    const tl = gsap.timeline({ onComplete })

    // Bottom progress sweeps the full duration
    if (progress) {
      tl.to(progress, { width: '100%', duration: TOTAL_DURATION, ease: 'none' }, 0)
    }

    // ── Scene 1: HERO (0–4s) ──
    if (heroScene) {
      const heroName = heroScene.querySelector(`.${styles.heroName}`)
      const heroSub = heroScene.querySelector(`.${styles.heroSubtitle}`)
      const heroLine = heroScene.querySelector(`.${styles.heroLine}`)
      tl.to(heroScene, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0.3)
      if (heroName) tl.fromTo(heroName,
        { opacity: 0, y: 24, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0)', duration: 1.0, ease: 'expo.out' }, 0.5)
      if (heroSub) tl.fromTo(heroSub,
        { opacity: 0, letterSpacing: '0.6em' },
        { opacity: 1, letterSpacing: '0.4em', duration: 0.9, ease: 'power2.out' }, 1.2)
      if (heroLine) tl.to(heroLine, { scaleX: 1, duration: 0.8, ease: 'power2.out' }, 1.6)
      tl.to(heroScene, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 3.6)
    }

    // ── Scene 2: METRIC STACK (4–9s) ──
    if (metricScene) {
      const metrics = metricScene.querySelectorAll(`.${styles.metric}`)
      tl.to(metricScene, { opacity: 1, duration: 0.4 }, 4.0)
      metrics.forEach((m, i) => {
        tl.fromTo(m,
          { opacity: 0, y: 28, filter: 'blur(6px)' },
          { opacity: 1, y: 0, filter: 'blur(0)', duration: 0.7, ease: 'expo.out' },
          4.2 + i * 0.18,
        )
      })
      tl.to(metricScene, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 8.4)
    }

    // ── Scene 3: PROJECT TILES (9–22s) — 6 projects × 2.16s each ──
    // Single opacity in/out for the scene container; each project
    // change triggers a brief filter pulse via gsap.fromTo from
    // INSIDE the call (not inserted into the master timeline) so the
    // scene's primary opacity tween isn't overwritten by 6 nested
    // fromTo's on the same element.
    if (projectScene) {
      tl.to(projectScene, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 9.0)
      const N = PROJECTS_TO_SHOW.length
      const tilesDur = 21.0 - 9.6  // 11.4s for N tiles
      const per = tilesDur / N
      for (let i = 0; i < N; i++) {
        const at = 9.6 + i * per
        tl.call(() => {
          setProjectIdx(i)
          // Standalone tween — fires AFTER setProjectIdx flushes the
          // re-render so the new project data is what's pulsing.
          gsap.fromTo(projectScene,
            { scale: 0.96, filter: 'blur(6px) brightness(1.3)' },
            { scale: 1, filter: 'blur(0) brightness(1)', duration: 0.55, ease: 'expo.out' },
          )
        }, [], at)
      }
      tl.to(projectScene, { opacity: 0, duration: 0.6, ease: 'power2.in' }, 21.4)
    }

    // ── Scene 4: TOOLS CLOUD (22–27s) ──
    if (toolsScene) {
      const tools = toolsScene.querySelectorAll(`.${styles.tool}`)
      tl.to(toolsScene, { opacity: 1, duration: 0.4 }, 22.0)
      tools.forEach((t, i) => {
        tl.fromTo(t,
          { opacity: 0, scale: 0.6, y: 16 },
          { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)' },
          22.2 + i * 0.08,
        )
      })
      tl.to(toolsScene, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 26.4)
    }

    // ── Scene 5: CTA (27–30s) ──
    if (ctaScene) {
      tl.to(ctaScene, { opacity: 1, duration: 0.5 }, 27.0)
      tl.fromTo(ctaScene,
        { y: 24, filter: 'blur(8px)' },
        { y: 0, filter: 'blur(0)', duration: 0.9, ease: 'expo.out' },
        27.0,
      )
      // Hold until 30s — onComplete fires automatically.
    }

    return () => { tl.kill() }
    // Mount-only — onComplete reference change MUST NOT re-run this
    // effect or the timeline restarts on every projectIdx tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={stageRef} className={styles.stage} role="presentation" aria-hidden="false">
      <div className={styles.scanlines} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <div className={`${styles.bar} ${styles.barTop}`} aria-hidden="true" />
      <div className={`${styles.bar} ${styles.barBottom}`} aria-hidden="true" />
      <div ref={progressRef} className={styles.progress} aria-hidden="true" />

      {/* Scene 1 — HERO */}
      <div ref={heroSceneRef} className={styles.scene}>
        <div className={styles.heroName}>BOJAN PETKOVIĆ</div>
        <div className={styles.heroLine} aria-hidden="true" />
        <div className={styles.heroSubtitle}>AUDIO DIRECTOR</div>
      </div>

      {/* Scene 2 — METRIC STACK */}
      <div ref={metricSceneRef} className={styles.scene}>
        <div className={styles.metricGrid}>
          <div className={styles.metric}>
            <div className={styles.metricNum}>8+</div>
            <div className={styles.metricLabel}>Years</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricNum}>50+</div>
            <div className={styles.metricLabel}>Titles Shipped</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricNum}>200+</div>
            <div className={styles.metricLabel}>SFX Designs</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricNum}>0</div>
            <div className={styles.metricLabel}>Defects</div>
          </div>
        </div>
      </div>

      {/* Scene 3 — PROJECT TILES */}
      <div
        ref={projectSceneRef}
        className={styles.scene}
        style={{ ['--proj-glow' as string]: `${projectScene.color}88` }}
      >
        <div className={styles.project}>
          <div className={styles.projectIco}>{projectScene.ico}</div>
          <div className={styles.projectName}>{projectScene.name}</div>
          <div className={styles.projectStudio}>{projectScene.studio}</div>
          <div className={styles.projectScope}>
            {projectScene.scope.music && <span>MUSIC</span>}
            {projectScene.scope.sfx && <span>SFX</span>}
            {projectScene.scope.integration && <span>INTEGR.</span>}
            {projectScene.scope.qa && <span>QA</span>}
          </div>
        </div>
      </div>

      {/* Scene 4 — TOOLS CLOUD */}
      <div ref={toolsSceneRef} className={styles.scene}>
        <div className={styles.toolsCloud}>
          {TOOLS.map((t) => (
            <span key={t} className={styles.tool}>{t}</span>
          ))}
        </div>
      </div>

      {/* Scene 5 — CTA */}
      <div ref={ctaSceneRef} className={styles.scene}>
        <div className={styles.cta}>
          <div className={styles.ctaText}>Explore Full Portfolio</div>
          <div className={styles.ctaArrow} aria-hidden="true">↓</div>
          <div className={styles.ctaHint}>Slot machine ahead — pull the lever</div>
        </div>
      </div>
    </div>
  )
}

export default CinematicTeaser
