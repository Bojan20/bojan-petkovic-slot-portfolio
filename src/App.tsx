/**
 * App — Root component (CORTEX Engine powered)
 *
 * Three-phase flow modeled after real slot cabinets:
 *
 * Phase 1: BOOT (BootScreen)
 *   - Neural-sync loader, CRT scanlines, tap-to-unlock
 *   - Tap = user gesture → AudioContext unlocked forever
 *
 * Phase 2: SPLASH (Attract Mode)
 *   - Lucky 7 cinematic timeline with glitch/implode exit
 *   - Lounge ambient music starts automatically
 *
 * Phase 3: SLOT (Main App)
 *   - Chromatic bleed cross-dissolve + elastic pop-in
 *
 * All audio, animations, and timing driven by engine config.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BootScreen } from './components/BootScreen'
// Moodboard route — lazy so the static moodboard CSS doesn't bloat
// the main bundle; only fetched when ?moodboard=v3 is present.
const MoodboardV3 = lazy(() =>
  import('./components/MoodboardV3').then((m) => ({ default: m.MoodboardV3 })),
)
import { SplashScreen } from './components/slot/SplashScreen'
import { SlotMachine } from './components/slot'
import { CasinoShower } from './components/slot/CasinoShower'
import { PullToRefresh } from './components/PullToRefresh'
import {
  bus,
  initAudioBridge, disposeAudioBridge,
  attachAnalyser, disposeAnalyser,
  listenForKonami,
  startHapticOrchestra, disposeHapticOrchestra,
  enableWakeLock, disableWakeLock,
  startPageVisibilityHandler, stopPageVisibilityHandler,
  registerAudioForVisibilityPause,
  startAdaptiveQuality,
  attachMediaSession, disposeMediaSession,
  startGamepadInput, stopGamepadInput,
  initSpeechAnnouncer, disposeSpeechAnnouncer,
  opfsFetchOrCache,
  loadCellMemory,
  scheduleKeyDetection,
  startPersonaInference, stopPersonaInference,
  startSectionVoice, stopSectionVoice,
  initTransitionDirector, disposeTransitionDirector, getTransitionDirector,
  startAudioBus, stopAudioBus, onAudioCue,
  playSynthById,
} from './engine'
import { RecIndicator } from './components/RecIndicator'
import { AriaAnnouncer } from './components/AriaAnnouncer'
import { HardwareToast } from './components/HardwareToast'
import { SkipIntroButton } from './components/SkipIntroButton'
import { useInputBridges } from './hooks/useInputBridges'
import { useSensorium } from './hooks/useSensorium'
import { useSessionCapture } from './hooks/useSessionCapture'
// Heavy panels lazy-loaded — they're keyboard-gated (Shift+A, Konami)
// or rare-render (PlatformChips post-boot only). Splitting them off
// drops ~120KB from the main bundle so first paint of the boot screen
// is faster.
const SlotAudioManager = lazy(() =>
  import('./components/SlotAudioManager').then((m) => ({ default: m.SlotAudioManager })),
)
const DevOverlay = lazy(() =>
  import('./components/DevOverlay').then((m) => ({ default: m.DevOverlay })),
)
import { VoiceIndicator } from './components/VoiceIndicator'
import { PlatformChips } from './components/PlatformChip'
import { ReachPill } from './components/ReachPill'
import { EngageToast } from './components/EngageToast'
import { useSoftFunnel } from './hooks/useSoftFunnel'
import { useAudioStore } from './store'

type AppPhase = 'boot' | 'splash' | 'entering' | 'slot'

// ?moodboard=v3 short-circuit — checked at module-load time so the
// entire App body (with its 30+ engine init effects) never runs when
// we're previewing the static moodboard. A separate component keeps
// React Hooks order clean — each branch has its own hook list.
function isMoodboardRoute(): boolean {
  return typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('moodboard') === 'v3'
}

function MoodboardRoute() {
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#05060f' }} />}>
      <MoodboardV3 />
    </Suspense>
  )
}

export default function App() {
  // Moodboard route bypass — renders only MoodboardV3 above the
  // engine pipeline so design review opens instantly without booting.
  if (isMoodboardRoute()) return <MoodboardRoute />

  return <AppMain />
}

function AppMain() {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [showerActive, setShowerActive] = useState(false)
  const [introLocked, setIntroLocked] = useState(true)
  // DevOverlay visibility — toggled by Konami code (↑↑↓↓←→←→BA)
  // OR by ?dev URL flag (lets recruiters open it directly via shared link).
  const [devOverlay, setDevOverlay] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).has('dev')
  })
  const slotWrapRef = useRef<HTMLDivElement>(null)
  const splashRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Sync body[data-phase] for global CSS tint + cursor policy
  useEffect(() => {
    document.body.setAttribute('data-phase', phase)
  }, [phase])

  // Remove the pre-shield div (set up in index.html to cover body bg
  // until React mounts BootScreen) the moment we enter the SPLASH
  // phase. Until this commit the shield was orphaned in the DOM
  // forever — z-index 1999, opacity 1, near-black background — and
  // covered the entire slot machine after the splash→slot transition,
  // producing a fully BLACK screen on the slot phase.
  useEffect(() => {
    if (phase === 'boot') return
    const shield = document.getElementById('pre-shield')
    if (!shield) return
    // Soft fade so we don't pop the BG between splash and slot
    shield.style.transition = 'opacity 320ms ease'
    shield.style.opacity = '0'
    setTimeout(() => shield.remove(), 360)
  }, [phase])

  // Pre-create ambient audio element. On the first visit we hit the
  // network (Service Worker also caches via Cache API as a backup);
  // on every subsequent visit we hand the audio element a blob URL
  // pointing into OPFS, so playback starts as soon as the user taps —
  // no network round-trip, no SW activation race, even fully offline.
  useEffect(() => {
    let revoke: string | null = null
    let cancelled = false

    const loadAmbient = async (): Promise<HTMLAudioElement> => {
      const a = new Audio()
      a.loop = true
      a.volume = 0.35
      a.preload = 'auto'

      const cached = await opfsFetchOrCache('/ambient/lounge.mp3', 'ambient/lounge.mp3').catch(() => null)
      if (cached?.blob) {
        const url = URL.createObjectURL(cached.blob)
        revoke = url
        a.src = url
      } else {
        // OPFS unavailable + fetch failed — fall back to direct URL,
        // which the Service Worker can still satisfy from Cache API.
        a.src = '/ambient/lounge.mp3'
      }
      return a
    }

    void loadAmbient().then((a) => {
      if (cancelled) {
        a.pause()
        a.src = ''
        if (revoke) URL.revokeObjectURL(revoke)
        return
      }
      audioRef.current = a
    })

    return () => {
      cancelled = true
      const a = audioRef.current
      if (a) {
        a.pause()
        a.src = ''
      }
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [])

  // Connect to CORTEX Audio Manager (WebSocket bridge) — idempotent
  useEffect(() => {
    initAudioBridge()
    return () => disposeAudioBridge()
  }, [])

  // Tear down audio analyser + MediaSession on unmount (HMR-safe)
  useEffect(() => {
    return () => {
      disposeAnalyser()
      disposeMediaSession()
    }
  }, [])

  // Konami code listener — ↑↑↓↓←→←→BA toggles the dev overlay.
  // Re-typing the sequence toggles it OFF (also: Esc, X button).
  useEffect(() => {
    const off = listenForKonami(() => setDevOverlay((v) => !v))
    return off
  }, [])

  // Gamepad polling + event subscribers — Xbox/PS/Switch controllers
  // play the slot natively. A=spin, B=mute, D-pad/RB-LB=nav, Start=dev,
  // left stick=parallax cursor (steers Lucky 7 alongside mouse/gyro).
  useEffect(() => {
    startGamepadInput()
    // Custom events emitted by GamepadInput that don't have direct
    // routing yet — translate them here.
    const offMute = bus.on('custom:mute_toggle' as 'custom:mute_toggle', () => {
      const a = audioRef.current
      const next = !useAudioStore.getState().isMuted
      useAudioStore.getState().setMuted(next)
      if (a) a.muted = next
    })
    const offDebug = bus.on('debug:toggle', () => setDevOverlay((v) => !v))
    return () => {
      stopGamepadInput()
      offMute()
      offDebug()
    }
  }, [])

  // Haptic orchestra — translates app events to vibration patterns.
  // Idempotent + HMR-safe; does nothing on devices without vibrate API.
  useEffect(() => {
    startHapticOrchestra()
    return () => disposeHapticOrchestra()
  }, [])

  // ── Platform polish: page visibility, wake lock, adaptive quality ──
  // Single mount-time effect — all four APIs are no-ops on unsupported
  // browsers, never throws, never spams console.
  useEffect(() => {
    startPageVisibilityHandler()
    void startAdaptiveQuality()
    return () => {
      stopPageVisibilityHandler()
      disableWakeLock()
    }
  }, [])

  // Wake lock + ambient audio visibility-pause — both wired the moment
  // the audio element is created. Wake lock is requested on boot:tap
  // (the canonical "user is engaging" gesture).
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const off = registerAudioForVisibilityPause(a)
    return off
  }, [])

  useEffect(() => {
    const off = bus.on('boot:tap', () => enableWakeLock())
    return off
  }, [])

  // Speech announcer — cinematic casino-host voice. Init AFTER boot:tap
  // (the canonical user gesture) so browsers don't drop the first
  // utterance. The announcer subscribes to boot:complete, splash:enter,
  // slot:section:change, slot:item:select, slot:win and voice:jackpot
  // internally; nothing else here. No-op on browsers without
  // window.speechSynthesis (older Samsung, locked-down kiosks).
  useEffect(() => {
    const off = bus.on('boot:tap', () => initSpeechAnnouncer())
    return () => {
      off()
      disposeSpeechAnnouncer()
    }
  }, [])

  // ── Composed lifecycle hooks (P1.13 refactor) ─────────────────────
  // Keyboard bindings + voice commands for snapshot/reel/HID/Serial/HR
  useSessionCapture({ audioRef })
  // WebHID + WebSerial auto-bind to already-authorized devices
  useInputBridges(9600)

  // Cell memory — load persisted visited-state from OPFS so the slot
  // can render returning-visitor cues. One-time load at mount; the
  // module debounces its own writes.
  useEffect(() => {
    void loadCellMemory()
  }, [])

  // Tonal coherence detector (P0.6) — scheduled when ambient music
  // starts. Once detected, fires audio:key event for any future
  // SoundManager retune logic to subscribe to. Idempotent.
  useEffect(() => {
    const off = bus.on('audio:ambient:start', () => scheduleKeyDetection())
    return off
  }, [])

  // Persona inference (P1.8) — start tracking on boot:complete so the
  // 30s warmup begins counting from a meaningful "user is engaged"
  // moment. Emits custom:persona:inferred when the label changes.
  useEffect(() => {
    const off = bus.on('boot:complete', () => startPersonaInference())
    return () => {
      off()
      stopPersonaInference()
    }
  }, [])

  // P4.5 — Section Voice. Five signature stings (one per section) play
  // on tab change. Wired after boot:complete so AudioContext is unlocked
  // and the synthetic first section render doesn't auto-trigger a sting
  // (SectionVoice internally suppresses the first emission).
  useEffect(() => {
    const off = bus.on('boot:complete', () => startSectionVoice())
    return () => {
      off()
      stopSectionVoice()
    }
  }, [])

  // Sensorium — ambient light + idle detector + presence + XR probe.
  // Idle pauses music; active resumes only past boot phase (AudioContext
  // unlock contract). Replaced 3 effects with one hook (P1.13 refactor).
  useSensorium({
    audioRef,
    shouldResumeAudio: () => phase !== 'boot',
    idleThresholdMs: 30_000,
  })

  // §2.11 Soft funnel — 30s/60s/120s non-blocking engagement escalators
  const { showEngageToast, dismissEngageToast } = useSoftFunnel(phase === 'slot')

  // ── Voice commands: session capture is wired in useSessionCapture ──

  // ── Voice command: mute / unmute ────────────────────────────────────
  // SlotMachine handles spin/next/back/jackpot itself (those need its
  // local handlers + state guards). Audio mute is app-level so we
  // subscribe here and call the audioStore directly.
  useEffect(() => {
    const setMuted = useAudioStore.getState().setMuted
    const offMute = bus.on('voice:command:mute', () => {
      setMuted(true)
      const a = audioRef.current
      if (a) a.muted = true
    })
    const offUnmute = bus.on('voice:command:unmute', () => {
      setMuted(false)
      const a = audioRef.current
      if (a) a.muted = false
    })
    return () => { offMute(); offUnmute() }
  }, [])

  // Start ambient music + wire FFT analyser + MediaSession the MOMENT
  // user taps boot. boot:tap is the canonical AudioContext-unlock
  // gesture, so it's the earliest legal point to (a) play() the music,
  // (b) construct the MediaElementSource → AnalyserNode pipeline, and
  // (c) register OS-level media controls. Doing it here (vs.
  // boot:complete) means CyberNebula's shader gets a few seconds of
  // live FFT data while the boot loader finishes — the nebula visibly
  // pulses to the music BEFORE the splash transition.
  useEffect(() => {
    const off = bus.on('boot:tap', () => {
      const audio = audioRef.current
      if (!audio) return
      audio.play().catch(() => {})
      attachAnalyser(audio)
      // Register with the OS media controls — recruiter sees title +
      // artist + artwork on lock screen + headphone buttons + macOS
      // Now Playing widget. nexttrack/previoustrack are repurposed
      // to nav slot sections (clever for a single-track portfolio).
      attachMediaSession(audio, {
        title: 'Lounge Ambient',
        artist: 'Bojan Petković',
        album: 'Slot Machine Portfolio',
        artwork: [
          { src: '/seven-cyber.png', sizes: '512x512', type: 'image/png' },
          { src: '/seven-symbol.png', sizes: '256x256', type: 'image/png' },
          { src: '/favicon.svg', sizes: '96x96', type: 'image/svg+xml' },
        ],
      })
    })
    return off
  }, [])

  // ── Cinematic transition orchestrator (TransitionDirector) ────────
  // Single source of truth for boot→splash→slot phase moves. Emits
  // cue labels that AudioBus subscribes to (J-cut: sound leads picture
  // by ~120ms). All phase setters flow through here.
  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    initTransitionDirector({
      matteEl: document.getElementById('cinematic-matte'),
      splashRef,
      slotWrapRef,
      setPhase,
      setShowerActive,
      setIntroLocked,
      reducedMotion,
    })
    startAudioBus()

    // Wire J-cut audio cues to existing SoundManager synths.
    // Each cue handler fires synchronously so the leadMs offset
    // (already provided by Director emitting BEFORE the picture
    // tweens) lands the sound 80–150ms ahead of visual change.
    const offBootSplash = onAudioCue('boot_to_splash_start', () => {
      try { playSynthById('cyberWind') } catch { /* ignore */ }
    })
    const offSplashEnter = onAudioCue('splash_enter', () => {
      try { playSynthById('whoosh') } catch { /* ignore */ }
    })
    const offMatchCut = onAudioCue('match_cut_peak', () => {
      try { playSynthById('hyperspaceSnap') } catch { /* ignore */ }
    })
    const offSlotReveal = onAudioCue('slot_reveal', () => {
      try { playSynthById('cyberBoot') } catch { /* ignore */ }
    })

    return () => {
      offBootSplash()
      offSplashEnter()
      offMatchCut()
      offSlotReveal()
      stopAudioBus()
      disposeTransitionDirector()
    }
  }, [])

  // Boot → Splash: delegate to TransitionDirector
  const handleBootComplete = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.play().catch(() => {})
      attachAnalyser(audio)
    }
    bus.emit('splash:start')
    getTransitionDirector()?.playBootToSplash()
  }, [])

  // Splash → Slot: delegate directly to TransitionDirector.
  // (Cinematic Teaser phase removed per Boki — splash goes
  // straight into the slot machine reveal.)
  const handleEnter = useCallback(() => {
    if (phase !== 'splash') return
    getTransitionDirector()?.playSplashToSlot()
  }, [phase])

  const handleShowerDone = useCallback(() => {
    setShowerActive(false)
    setIntroLocked(false)
    bus.emit('transition:complete')
  }, [])

  return (
    <>
      {/* Slot machine — always mounted, hidden until transition */}
      <div
        ref={slotWrapRef}
        style={{
          // Keep at 0 through 'entering' so GSAP can fromTo/to without
          // a one-frame flash when React's re-render removes the inline style.
          // GSAP writes element.style on every RAF tick and wins the race
          // against React's per-render write once the timeline starts.
          opacity: (phase === 'boot' || phase === 'splash' || phase === 'entering') ? 0 : undefined,
          willChange: phase === 'entering' ? 'opacity, filter, transform' : undefined,
        }}
      >
        <SlotMachine locked={introLocked} entering={phase === 'entering'} />
      </div>

      {/* Casino particle shower — coins, chips, dice rain */}
      <CasinoShower active={showerActive} onComplete={handleShowerDone} />

      {/* Cinematic matte — pure black overlay used for all scene transitions.
          Fades to black between phases, then dissolves to reveal the next scene. */}
      <div
        id="cinematic-matte"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 3001,
          pointerEvents: 'none',
          opacity: 0,
          background: '#000',
        }}
      />

      {/* Splash — attract mode with auto SFX */}
      {(phase === 'splash' || phase === 'entering') && (
        <SplashScreen ref={splashRef} onEnter={handleEnter} />
      )}

      {/* Cinematic Teaser removed from active flow — kept as module
          for future reuse if strategy changes. */}

      {/* Boot screen — on top of everything, removed after tap */}
      {phase === 'boot' && (
        <BootScreen onComplete={handleBootComplete} />
      )}

      {/* Slot Audio Manager — Shift+A to toggle. Lazy: panel is invisible
          until first toggle so the import only runs on demand. */}
      <Suspense fallback={null}>
        <SlotAudioManager />
      </Suspense>

      {/* Voice control — handsfree commands (mic icon bottom-left, V key) */}
      <VoiceIndicator />

      {/* Konami dev overlay — ↑↑↓↓←→←→BA to toggle, or ?dev URL flag.
          Lazy: only loads after Konami is entered or ?dev URL is set. */}
      {devOverlay && (
        <Suspense fallback={null}>
          <DevOverlay visible={devOverlay} onClose={() => setDevOverlay(false)} phase={phase} />
        </Suspense>
      )}

      {/* ReachPill — always-visible "AVAILABLE · REACH OUT ↗" CTA (§2.10) */}
      <ReachPill visible={phase === 'slot'} />

      {/* Soft funnel — 60s engage toast (§2.11) */}
      <EngageToast visible={showEngageToast} onDismiss={dismissEngageToast} />

      {/* Platform chips — Share + Lite-mode badge top-right (post-boot) */}
      <PlatformChips visible={phase !== 'boot'} />

      {/* Pull-to-refresh — active in boot/splash, suppressed during slot
          interaction (slot has its own swipe gestures for section + reel) */}
      <PullToRefresh enabled={phase !== 'slot'} />

      {/* Recording indicator — top-right ● REC chip while a portfolio
          reel is being captured via Ctrl/Cmd+Shift+R. Auto-hides when
          recording stops or saves. */}
      <RecIndicator />

      {/* PresenceChip removed from UI — engine module (Phase 22) stays
          available for future "real" presence with a WebTransport relay,
          but the BroadcastChannel-only LOCAL tier just counts same-origin
          tabs on the visitor's own machine, which has no value for the
          recruiter. Surfacing only on a future relay-backed deployment. */}

      {/* ARIA live region (P0.5) — visually-hidden polite announcer
          that mirrors SpeechAnnouncer events to assistive tech. */}
      <AriaAnnouncer />

      {/* Hardware auto-detect toast (P1.12) — surfaces "new device
          detected, pair now?" when a USB/BLE device appears while
          the tab regains focus. Click triggers the standard
          gesture-required pair picker. */}
      <HardwareToast />

      {/* Skip Intro — courtesy escape during boot/splash/teaser/entering.
          Click → TransitionDirector.skip() runs splash→slot animation
          shortcutting any in-flight cinematic. */}
      <SkipIntroButton visible={phase !== 'slot'} />
    </>
  )
}
