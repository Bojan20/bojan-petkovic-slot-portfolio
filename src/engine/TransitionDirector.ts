/**
 * TransitionDirector — single source of truth for boot→splash→slot
 * cinematic phase orchestration.
 *
 * Replaces the previous setTimeout chain + per-handler GSAP timelines
 * with one master timeline that the whole app drives through. Phase
 * changes are emitted as React state via `onPhaseChange` callback;
 * audio cues are emitted as bus events that AudioBus subscribes to.
 *
 * Why a single timeline:
 *   • Skip Intro (Ctrl+Skip) becomes one call — `skip()` jumps to
 *     `slot_ready` and tears down everything en route.
 *   • Audio J-cut / L-cut works because cue labels are attached at
 *     timeline positions, not bound to individual setTimeout calls.
 *   • Reduced-motion fallback collapses the same labels into a
 *     900–1200ms compressed flow without re-implementing the logic.
 *   • One GSAP context tearable on HMR / unmount.
 *
 * Labels (from GPT cinematic panel synthesis):
 *   boot_to_splash_start  — fade to black + audio rumble J-cut starts
 *   boot_black_dip        — full black, brief hold
 *   splash_enter          — splash mounted, fade up under matte
 *   splash_intro_settle   — splash hero held
 *   splash_to_slot_start  — match-cut Lucky 7 → reel mask begins
 *   match_cut_peak        — peak of the match-cut, slot is invisible
 *   slot_reveal           — slot scales/blurs in
 *   slot_ready            — done, idle, all locks released
 */

import gsap from 'gsap'
import { bus } from './EventBus'

export type AppPhase = 'boot' | 'splash' | 'entering' | 'slot'

export type TransitionLabel =
  | 'boot_to_splash_start'
  | 'boot_black_dip'
  | 'splash_enter'
  | 'splash_intro_settle'
  | 'splash_to_slot_start'
  | 'match_cut_peak'
  | 'slot_reveal'
  | 'slot_ready'

export interface DirectorOpts {
  matteEl: HTMLElement | null
  splashRef: { current: HTMLElement | null }
  slotWrapRef: { current: HTMLElement | null }
  setPhase: (p: AppPhase) => void
  setShowerActive: (v: boolean) => void
  setIntroLocked: (v: boolean) => void
  reducedMotion: boolean
}

let _director: Director | null = null

class Director {
  private tl: gsap.core.Timeline | null = null
  private opts: DirectorOpts
  /** True once an active timeline has been created (boot→splash or
   *  splash→slot). Skip target depends on which one is running. */
  private currentRun: 'boot_to_splash' | 'splash_to_slot' | null = null
  private skipped = false

  constructor(opts: DirectorOpts) {
    this.opts = opts
  }

  /** Boot → Splash. Creates a fresh timeline; previous one is killed. */
  playBootToSplash(): void {
    this.killActive()
    this.skipped = false
    this.currentRun = 'boot_to_splash'
    const matte = this.opts.matteEl
    const reduced = this.opts.reducedMotion

    // Fire J-cut audio cue 120ms before any picture moves
    bus.emit('custom:transition:cue', { label: 'boot_to_splash_start', leadMs: 120 })

    if (!matte || reduced) {
      // No matte element OR reduced motion — instant phase swap
      this.opts.setPhase('splash')
      bus.emit('custom:transition:cue', { label: 'splash_enter', leadMs: 0 })
      this.currentRun = null
      return
    }

    const tl = gsap.timeline({
      onComplete: () => {
        this.currentRun = null
        bus.emit('custom:transition:cue', { label: 'splash_intro_settle', leadMs: 0 })
      },
    })
    this.tl = tl

    // ── Cinematic "lights out" iris close ──────────────────────────────
    // Phase 1 (0–0.38s) — matte slams to FULL BLACK (power3.in = aggressive
    // acceleration, like a shutter snapping shut). No half-measures.
    tl.to(matte, { opacity: 1, duration: 0.38, ease: 'power3.in' }, 0)

    // Phase 2 — HOLD 90ms at true black (cinema breath — recruiter's eye
    // has a frame to reset before the splash world materialises).
    tl.addLabel('boot_dim_peak', 0.38)
    tl.call(() => {
      this.opts.setPhase('splash')
      bus.emit('custom:transition:cue', { label: 'splash_enter', leadMs: 80 })
    }, [], 'boot_dim_peak+=0.09')

    // Phase 3 — matte snaps off (power3.out = crisp, confident reveal).
    // Positioned to start at the same instant as the phase-swap call.
    tl.to(matte, { opacity: 0, duration: 0.30, ease: 'power3.out' }, 'boot_dim_peak+=0.09')
  }

  /** Splash → Slot with match-cut Lucky 7 → reel viewport. */
  playSplashToSlot(): void {
    this.killActive()
    this.skipped = false
    this.currentRun = 'splash_to_slot'

    const splashEl = this.opts.splashRef.current
    const slotEl = this.opts.slotWrapRef.current
    const matte = this.opts.matteEl
    const reduced = this.opts.reducedMotion

    bus.emit('custom:transition:cue', { label: 'splash_to_slot_start', leadMs: 120 })

    // Lock slot invisible BEFORE React re-render — GSAP wins the race.
    // Start from dramatic over-scale + heavy blur so the expansion is felt.
    if (slotEl) {
      gsap.set(slotEl, { opacity: 0, scale: 1.07, filter: 'blur(16px)' })
    }

    this.opts.setPhase('entering')
    this.opts.setShowerActive(true)
    bus.emit('splash:enter')
    bus.emit('transition:splash_to_slot')

    if (reduced) {
      // Reduced motion — flat 800ms dissolve, no scale/blur drama
      const tl = gsap.timeline({
        onComplete: () => this.completeSplashToSlot(),
      })
      this.tl = tl
      if (splashEl) tl.to(splashEl, { opacity: 0, duration: 0.4 }, 0)
      if (slotEl) tl.to(slotEl, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.4 }, 0)
      return
    }

    const tl = gsap.timeline({ onComplete: () => this.completeSplashToSlot() })
    this.tl = tl

    // ── Phase 1 (0–0.48s) — "burned exit" ─────────────────────────────
    // Splash overexposes before it dies — like a film frame held too long
    // in the projector gate. power3.in = aggressive accelerating burn.
    if (splashEl) {
      tl.to(splashEl, {
        opacity: 0,
        scale: 0.95,
        filter: 'blur(6px) brightness(2.4)',
        duration: 0.48,
        ease: 'power3.in',
      }, 0)
    }

    // ── Phase 2 (0.28–0.58s) — FULL BLACK CUT ─────────────────────────
    // Matte hits opacity 1 (not a dim — a real hard cut). The brief pure-
    // black hold between splash exit and slot reveal is the cinematic
    // "match-cut" frame — gives the recruiter's eye a reset point and
    // amplifies the slot reveal that follows.
    if (matte) {
      tl.to(matte, { opacity: 1, duration: 0.30, ease: 'power3.in' }, 0.28)
      tl.addLabel('match_cut_peak', 0.58)
      tl.call(() => {
        bus.emit('custom:transition:cue', { label: 'match_cut_peak', leadMs: 0 })
      }, [], 'match_cut_peak')
      // Matte dissolves WHILE the slot expands — simultaneous reveal
      tl.to(matte, { opacity: 0, duration: 0.64, ease: 'power2.out' }, 0.74)
    }

    // ── Phase 3 (0.62s) — audio J-cut just before slot becomes visible
    tl.call(() => {
      bus.emit('custom:transition:cue', { label: 'slot_reveal', leadMs: 0 })
    }, [], 0.62)

    // ── Phase 4 (0.62–1.50s) — SLOT SLAMS IN ──────────────────────────
    // Expands from scale(1.07) → 1 while blur dissolves. power3.out = the
    // machine "arrives with weight" — fast start, organic settle.
    // Previous: scale(1.012) barely visible. New: +7% = unmistakeable.
    if (slotEl) {
      tl.fromTo(slotEl,
        { opacity: 0, scale: 1.07, filter: 'blur(16px)' },
        {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px)',
          duration: 0.88,
          ease: 'power3.out',
        }, 0.62)
    }

    // CRITICAL — wait for SlotMachine genesis (1.55s once entering=true)
    // to fully reveal cells / tabs / controls BEFORE flipping phase →
    // 'slot'. Genesis is gated on entering=true; if we transition to
    // 'slot' mid-genesis it triggers black-screen.
    // slot-fade: 0.62 + 0.88 = 1.50s, genesis ~1.55s from entering=true
    // (entering was set at the very top of this method, so clock starts now).
    // 0.70s tail → total 2.20s → covers genesis with 0.65s margin.
    tl.to({}, { duration: 0.70 })
  }

  private completeSplashToSlot(): void {
    this.opts.setPhase('slot')
    this.currentRun = null
    bus.emit('custom:transition:cue', { label: 'slot_ready', leadMs: 0 })
  }

  /** Skip current cinematic — jump directly to slot_ready. */
  skip(): void {
    if (this.skipped) return
    this.skipped = true

    if (this.currentRun === 'boot_to_splash') {
      // We're mid boot→splash. Jump to splash_intro_settle (post-fade).
      this.killActive()
      const matte = this.opts.matteEl
      if (matte) gsap.set(matte, { opacity: 0 })
      this.opts.setPhase('splash')
      bus.emit('custom:transition:cue', { label: 'splash_intro_settle', leadMs: 0 })
      this.currentRun = null
      return
    }

    if (this.currentRun === 'splash_to_slot') {
      this.killActive()
      const splashEl = this.opts.splashRef.current
      const matte = this.opts.matteEl
      const slotEl = this.opts.slotWrapRef.current
      if (splashEl) gsap.set(splashEl, { opacity: 0 })
      if (matte) gsap.set(matte, { opacity: 0 })
      if (slotEl) gsap.set(slotEl, { opacity: 1, scale: 1, filter: 'blur(0px)' })
      this.completeSplashToSlot()
      return
    }

    // Idle (no active run) — most common case is the recruiter
    // skipping the CinematicTeaser. Run the actual splash→slot
    // animation so the slot reveal still has the cinematic moment
    // (faded splash, matte dip, slot rises). Skipping is a
    // courtesy — it shouldn't replace one cinema with a hard cut.
    this.playSplashToSlot()
  }

  private killActive(): void {
    if (this.tl) {
      this.tl.kill()
      this.tl = null
    }
  }

  destroy(): void {
    this.killActive()
    this.currentRun = null
  }
}

export function initTransitionDirector(opts: DirectorOpts): void {
  if (_director) _director.destroy()
  _director = new Director(opts)
}

export function getTransitionDirector(): Director | null {
  return _director
}

export function disposeTransitionDirector(): void {
  if (_director) _director.destroy()
  _director = null
}
