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

    // Cross-dissolve through DIM (not full black). Total ~0.85s, no
    // pure-black frame, matte peaks at 0.92 instead of 1.0 so the
    // incoming splash is visible underneath as it materializes.
    //
    // Phase 1 (0–0.42s) — matte rises 0 → 0.92, boot dims out
    tl.to(matte, { opacity: 0.92, duration: 0.42, ease: 'power2.in' }, 0)

    // Phase 2 — at peak dim, swap React to splash. Splash is now
    // mounted underneath the matte. NO hold — go straight into
    // matte fade-out so we never have a static dim frame.
    tl.addLabel('boot_dim_peak', 0.42)
    tl.call(() => {
      this.opts.setPhase('splash')
      bus.emit('custom:transition:cue', { label: 'splash_enter', leadMs: 80 })
    }, [], 'boot_dim_peak')

    // Phase 3 — matte fades out, splash reveals through
    tl.to(matte, { opacity: 0, duration: 0.43, ease: 'power2.out' })
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

    // Lock slot invisible BEFORE React re-render — GSAP wins the race
    if (slotEl) {
      gsap.set(slotEl, { opacity: 0, scale: 1.012, filter: 'blur(8px)' })
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
      if (slotEl) tl.to(slotEl, { opacity: 1, duration: 0.4 }, 0)
      return
    }

    const tl = gsap.timeline({ onComplete: () => this.completeSplashToSlot() })
    this.tl = tl

    // Phase 1 — splash compresses & dims (the "match" half)
    if (splashEl) {
      tl.to(splashEl, {
        opacity: 0,
        scale: 0.92,
        filter: 'blur(8px) brightness(1.4)',
        duration: 0.85,
        ease: 'power2.inOut',
      }, 0)
    }

    // Phase 2 — matte rises mid-cut for depth
    if (matte) {
      tl.to(matte, { opacity: 0.55, duration: 0.4, ease: 'power2.in' }, 0.32)
      tl.addLabel('match_cut_peak', 0.55)
      tl.call(() => {
        bus.emit('custom:transition:cue', { label: 'match_cut_peak', leadMs: 0 })
      }, [], 'match_cut_peak')
      tl.to(matte, { opacity: 0, duration: 0.65, ease: 'power2.out' }, 0.72)
    }

    // Phase 3 — slot reveals from the match-cut center, expanding outward
    bus.emit('custom:transition:cue', { label: 'slot_reveal', leadMs: 80 })
    if (slotEl) {
      tl.fromTo(slotEl,
        { opacity: 0, scale: 1.012, filter: 'blur(8px)' },
        {
          opacity: 1,
          scale: 1,
          filter: 'blur(0)',
          duration: 1.05,
          ease: 'power2.out',
        }, 0.6)
    }

    // CRITICAL — wait for SlotMachine genesis (1.55s once entering=true)
    // to fully reveal cells / tabs / controls BEFORE flipping phase →
    // 'slot'. Genesis is gated on entering=true; if we transition to
    // 'slot' mid-genesis it triggers black-screen because the genesis
    // useEffect's cleanup used to kill the in-flight tween.
    // 0.6 (slot-fade start) + 1.05 (slot-fade duration) = 1.65,
    // genesis completes by ~1.55, so a 1.4s tail leaves margin.
    tl.to({}, { duration: 1.4 })
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
      if (slotEl) gsap.set(slotEl, { opacity: 1, scale: 1, filter: 'blur(0)' })
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
