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
      document.body.removeAttribute('data-letterbox')
      this.opts.setPhase('splash')
      bus.emit('custom:transition:cue', { label: 'splash_enter', leadMs: 0 })
      this.currentRun = null
      return
    }

    const tl = gsap.timeline({
      onComplete: () => {
        this.currentRun = null
        // Pull letterbox bars out — splash world established
        document.body.removeAttribute('data-letterbox')
        bus.emit('custom:transition:cue', { label: 'splash_intro_settle', leadMs: 0 })
      },
    })
    this.tl = tl

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // V4.3 — 5-ACT CINEMATIC OPENING (1.55s total)
    //
    //   ACT I  (0.00–0.20s) — letterbox slides in (camera frames it)
    //   ACT II (0.10–0.50s) — boot dolly back: scale 1→0.94, blur 0→14px
    //                          (simultaneous with matte close)
    //   ACT III(0.20–0.55s) — matte slams to full black (power3.in)
    //   ACT IV (0.55–0.74s) — HOLD true black 190ms (cinema breath)
    //   ACT V  (0.74–1.55s) — splash zooms IN: scale 1.18→1, blur 28→0,
    //                          brightness 0→1, matte fades out
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── ACT I — letterbox bars slide in immediately ──────────
    tl.call(() => {
      document.body.setAttribute('data-letterbox', 'active')
    }, [], 0)

    // ── ACT II — matte slams to full black (lights out) ──────
    tl.to(matte, { opacity: 1, duration: 0.45, ease: 'power3.in' }, 0)

    // ── ACT IV — Hold 190ms in true black, swap React phase ──
    tl.addLabel('blackout', 0.55)
    tl.call(() => {
      this.opts.setPhase('splash')
      bus.emit('custom:transition:cue', { label: 'splash_enter', leadMs: 80 })
    }, [], 'blackout+=0.19')

    // ── ACT V — Matte dissolves, splash rack-focuses in ──────
    // Splash starts over-scaled + blurred (rack focus reveal —
    // like a lens pulling from infinity to subject). No brightness
    // spikes — pure scale + blur → cinema, not epilepsy.
    const splashEl = this.opts.splashRef.current
    if (splashEl) {
      gsap.set(splashEl, { opacity: 0, scale: 1.10, filter: 'blur(18px)' })
    }

    tl.to(matte, { opacity: 0, duration: 0.52, ease: 'power3.out' }, 'blackout+=0.19')

    if (splashEl) {
      tl.fromTo(splashEl,
        { opacity: 0, scale: 1.10, filter: 'blur(18px)' },
        {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px)',
          duration: 0.72,
          ease: 'power3.out',
        }, 'blackout+=0.22')
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
    this.opts.setShowerActive(true)
    bus.emit('splash:enter')
    bus.emit('transition:splash_to_slot')

    if (reduced) {
      // Reduced motion — flat splash exit, matte black, NO slot
      // reveal here (deferred to revealSlotAfterShower so the chip
      // shower owns the cinematic moment).
      const tl = gsap.timeline()
      this.tl = tl
      if (splashEl) tl.to(splashEl, { opacity: 0, duration: 0.4 }, 0)
      if (matte) tl.to(matte, { opacity: 1, duration: 0.4 }, 0)
      return
    }

    const tl = gsap.timeline()
    this.tl = tl

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // V5.6 — Two-stage cinematic. Director handles splash exit +
    // matte to black + shower spawn ONLY. Slot reveal is deferred
    // to revealSlotAfterShower(), called by App.handleShowerDone
    // when the casino chip/dice shower physics settles.
    //
    //   ACT I   (0.00–0.42s) — splash recedes: scale 1→0.96,
    //                          blur 0→8px, opacity 1→0  (dolly back)
    //   ACT II  (0.28–0.58s) — matte hard cuts to full black
    //   ACT III (0.58s)      — match-cut audio cue
    //   ACT IV  (—)          — HOLD black under shower (shower runs
    //                          on top, slot stays opacity 0).
    //                          Slot reveal triggered by handleShowerDone.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── ACT I — Splash recedes / dolly back ──────────────────
    if (splashEl) {
      tl.to(splashEl, {
        opacity: 0,
        scale: 0.96,
        filter: 'blur(8px)',
        duration: 0.42,
        ease: 'power2.in',
      }, 0)
    }

    // ── ACT II — Matte full black cut ────────────────────────
    if (matte) {
      tl.to(matte, { opacity: 1, duration: 0.30, ease: 'power3.in' }, 0.28)
    }

    // ── ACT III — Match-cut audio cue at full black ───────────
    tl.addLabel('match_cut_peak', 0.58)
    tl.call(() => {
      bus.emit('custom:transition:cue', { label: 'match_cut_peak', leadMs: 0 })
    }, [], 'match_cut_peak')

    // No slot reveal here. Black holds. Shower runs on top.
    // revealSlotAfterShower() does the rest when shower completes.
  }

  /**
   * V5.6 — slot reveal triggered by App.handleShowerDone, AFTER the
   * casino chip/dice physics has fully settled. Does the full slot
   * + world fade-in over a single cinematic timeline so cabinet AND
   * background bloom in together.
   */
  revealSlotAfterShower(): void {
    const slotEl = this.opts.slotWrapRef.current
    const matte = this.opts.matteEl
    const reduced = this.opts.reducedMotion
    if (!slotEl) {
      // Edge case — fallback to instant slot phase
      document.body.removeAttribute('data-letterbox')
      this.completeSplashToSlot()
      return
    }

    this.killActive()

    if (reduced) {
      const tl = gsap.timeline({
        onComplete: () => {
          document.body.removeAttribute('data-letterbox')
          this.completeSplashToSlot()
        },
      })
      this.tl = tl
      tl.to(slotEl, { opacity: 1, duration: 0.5 }, 0)
      if (matte) tl.to(matte, { opacity: 0, duration: 0.5 }, 0)
      return
    }

    const tl = gsap.timeline({
      onComplete: () => {
        document.body.removeAttribute('data-letterbox')
        this.completeSplashToSlot()
      },
    })
    this.tl = tl

    bus.emit('custom:transition:cue', { label: 'slot_reveal', leadMs: 0 })

    // Slot rack-focuses in: blur 16px → 0, scale 1.07 → 1, opacity
    // 0 → 1, over 1.10s for a generous, soft bloom (was 0.88s).
    tl.fromTo(slotEl,
      { opacity: 0, scale: 1.07, filter: 'blur(16px)' },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 1.10,
        ease: 'power3.out',
      }, 0)

    // Matte dissolves WITH the slot reveal (not before, not after) —
    // background world + cabinet bloom in simultaneously, just like
    // Boki asked: "u isto vreme".
    if (matte) {
      tl.to(matte, { opacity: 0, duration: 1.00, ease: 'power2.out' }, 0.10)
    }

    // Pull letterbox — cabinet established
    tl.call(() => {
      document.body.removeAttribute('data-letterbox')
    }, [], 0.85)

    // Tail — genesis safety margin
    tl.to({}, { duration: 0.55 })
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

    // Clear cinematic transition flags on any skip
    document.body.removeAttribute('data-letterbox')

    if (this.currentRun === 'boot_to_splash') {
      // We're mid boot→splash. Jump to splash_intro_settle (post-fade).
      this.killActive()
      const matte = this.opts.matteEl
      if (matte) gsap.set(matte, { opacity: 0 })
      const splashEl = this.opts.splashRef.current
      if (splashEl) gsap.set(splashEl, { opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)' })
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
