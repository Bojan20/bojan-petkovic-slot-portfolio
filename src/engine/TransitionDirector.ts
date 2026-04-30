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
import { flushSync } from 'react-dom'
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

  /** Boot → Splash. Matte-guarded flushSync transition — zero artifacts. */
  playBootToSplash(): void {
    this.killActive()
    this.skipped = false
    this.currentRun = 'boot_to_splash'
    const matte = this.opts.matteEl
    const reduced = this.opts.reducedMotion

    bus.emit('custom:transition:cue', { label: 'boot_to_splash_start', leadMs: 0 })

    if (reduced) {
      document.body.removeAttribute('data-letterbox')
      this.opts.setPhase('splash')
      bus.emit('custom:transition:cue', { label: 'splash_enter', leadMs: 0 })
      this.currentRun = null
      return
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // V9.2 — Matte-guarded flushSync cross-fade (0.70s total)
    //
    //   t=0.00–0.18s  Matte rises to 0.92 (covers BootScreen exit,
    //                 sevenStage parallax artifacts, any DOM residue)
    //   t=0.18s       flushSync setPhase('splash') → React commits
    //                 SplashScreen synchronously → splashRef is set
    //                 gsap.set(splash, opacity:0) — hidden before reveal
    //   t=0.18–0.70s  Matte dissolves + splash reveals simultaneously
    //
    // flushSync is the key: requestAnimationFrame fires BEFORE React
    // commit, so splashRef.current was null and the pre-hide never ran.
    // flushSync forces a synchronous render+commit at exactly t=0.18s,
    // guaranteeing ref availability with zero timing ambiguity.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    if (matte) gsap.set(matte, { opacity: 0 })

    const tl = gsap.timeline({
      onComplete: () => {
        this.currentRun = null
        document.body.removeAttribute('data-letterbox')
        bus.emit('custom:transition:cue', { label: 'splash_intro_settle', leadMs: 0 })
      },
    })
    this.tl = tl

    // ── ACT I — Matte rises, covers boot/splash swap seam ────
    if (matte) {
      tl.to(matte, { opacity: 0.92, duration: 0.18, ease: 'power3.in' }, 0)
    }

    // ── ACT II — flushSync commit at matte peak ───────────────
    tl.call(() => {
      // Force synchronous React render+commit — splashRef.current guaranteed
      flushSync(() => this.opts.setPhase('splash'))
      bus.emit('custom:transition:cue', { label: 'splash_enter', leadMs: 0 })

      const splashEl = this.opts.splashRef.current
      // Pre-hide with visibility:hidden, not just opacity:0.
      // SplashScreen has will-change:transform children (sevenStage, lensFlare)
      // that are promoted to GPU compositor layers. opacity:0 on parent does NOT
      // hide promoted children — browser composites them separately. Only
      // visibility:hidden is spec-guaranteed to propagate through all layers.
      if (splashEl) {
        gsap.set(splashEl, { opacity: 0, scale: 1.05, visibility: 'hidden' })
        // Reveal: lift visibility the instant animation starts, then fade in
        gsap.to(splashEl, {
          opacity: 1,
          scale: 1,
          duration: 0.52,
          ease: 'power3.out',
          onStart: () => {
            if (splashEl) splashEl.style.visibility = 'visible'
          },
        })
      }
    }, [], 0.18)

    // ── ACT III — Matte dissolves, splash blooms through ─────
    if (matte) {
      tl.to(matte, { opacity: 0, duration: 0.52, ease: 'power2.out' }, 0.18)
    }
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
    // V5.8 — chip/dice shower restored: starts AT THE MOMENT the slot
    // becomes visible (act IV of the timeline below), so the cabinet
    // emerges from a rain of coins+dice, not before. Triggered via
    // tl.call at 0.62s, see ACT IV.
    bus.emit('splash:enter')
    bus.emit('transition:splash_to_slot')

    if (reduced) {
      // Reduced motion — flat 800ms splash exit + slot fade-in
      const tl = gsap.timeline({
        onComplete: () => {
          document.body.removeAttribute('data-letterbox')
          this.completeSplashToSlot()
        },
      })
      this.tl = tl
      if (splashEl) tl.to(splashEl, { opacity: 0, duration: 0.4 }, 0)
      if (slotEl) tl.to(slotEl, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.4 }, 0)
      if (matte) tl.to(matte, { opacity: 0, duration: 0.4 }, 0.2)
      // V5.8 — shower also fires under reduced motion; it has its
      // own reduced-motion handling (slower, fewer particles)
      tl.call(() => this.opts.setShowerActive(true), [], 0.2)
      return
    }

    const tl = gsap.timeline({
      onComplete: () => {
        document.body.removeAttribute('data-letterbox')
        this.completeSplashToSlot()
      },
    })
    this.tl = tl

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // V9.0 — Tighter match-cut, 180ms crnog ekrana umesto 340ms.
    //
    //   ACT I   (0.00–0.32s) — splash recedes: scale 1→0.96,
    //                          blur 0→6px, opacity 1→0  (dolly back)
    //   ACT II  (0.20–0.40s) — matte hard cuts to full black
    //   ACT III (0.40s)      — match-cut audio cue at full black
    //   ACT IV  (0.44–1.44s) — slot rack-focuses in: scale 1.07→1,
    //                          blur 14px→0, opacity 0→1  (1.00s)
    //   ACT V   (0.52–1.44s) — matte dissolves with the slot reveal
    //   ACT VI  (0.68s)      — letterbox bars retract
    //   ACT VII (1.44–1.80s) — genesis safety tail
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── ACT I — Splash recedes / dolly back ──────────────────
    // No blur tween: animating filter on opacity:0 parent preserves
    // GPU compositor layers for will-change:transform children (sevenStage)
    // causing the Lucky 7 RGB ghost. Pure opacity+scale fade, then
    // visibility:hidden ensures promoted layers are fully hidden.
    if (splashEl) {
      tl.to(splashEl, {
        opacity: 0,
        scale: 0.97,
        duration: 0.28,
        ease: 'power2.in',
        onComplete: () => {
          if (splashEl) {
            splashEl.style.visibility = 'hidden'
            splashEl.style.willChange = 'auto'
          }
        },
      }, 0)
    }

    // ── ACT II — Matte full black cut (shorter: 200ms ramp) ──
    if (matte) {
      tl.to(matte, { opacity: 1, duration: 0.20, ease: 'power3.in' }, 0.20)
    }

    // ── ACT III — Match-cut audio cue at full black ───────────
    tl.addLabel('match_cut_peak', 0.40)
    tl.call(() => {
      bus.emit('custom:transition:cue', { label: 'match_cut_peak', leadMs: 0 })
    }, [], 'match_cut_peak')

    // ── ACT IV — Slot rack-focuses in + shower starts ─────────
    tl.call(() => {
      bus.emit('custom:transition:cue', { label: 'slot_reveal', leadMs: 0 })
      // Chip/dice shower starts as slot blooms in
      this.opts.setShowerActive(true)
    }, [], 0.44)

    if (slotEl) {
      tl.fromTo(slotEl,
        { opacity: 0, scale: 1.07, filter: 'blur(14px)' },
        {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px)',
          duration: 1.00,
          ease: 'power3.out',
        }, 0.44)
    }

    // ── ACT V — Matte dissolves with the slot reveal ──────────
    if (matte) {
      tl.to(matte, { opacity: 0, duration: 0.92, ease: 'power2.out' }, 0.52)
    }

    // ── ACT VI — Letterbox retract ────────────────────────────
    tl.call(() => {
      document.body.removeAttribute('data-letterbox')
    }, [], 0.68)

    // Genesis safety tail
    tl.to({}, { duration: 0.36 })
  }

  private completeSplashToSlot(): void {
    this.opts.setPhase('slot')
    // V5.7 — was unlocked via App.handleShowerDone, but the shower is
    // no longer part of the transition. Director now owns the unlock.
    this.opts.setIntroLocked(false)
    this.currentRun = null
    bus.emit('custom:transition:cue', { label: 'slot_ready', leadMs: 0 })
  }

  /** Skip current cinematic — jump directly to slot_ready. */
  skip(): void {
    if (this.skipped) return
    this.skipped = true

    // Clear cinematic transition flags on any skip
    document.body.removeAttribute('data-letterbox')

    if (this.currentRun === 'boot_to_splash') {
      // We're mid boot→splash. Jump to splash_intro_settle (post-fade).
      this.killActive()
      const matte = this.opts.matteEl
      if (matte) gsap.set(matte, { opacity: 0 })
      flushSync(() => this.opts.setPhase('splash'))
      const splashEl = this.opts.splashRef.current
      if (splashEl) gsap.set(splashEl, { opacity: 1, scale: 1, visibility: 'visible' })
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
      if (slotEl) gsap.set(slotEl, { opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)' })
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
